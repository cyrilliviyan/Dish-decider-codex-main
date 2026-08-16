# TableAI Project - Security & Code Quality Audit Report

## 🔴 CRITICAL VULNERABILITIES

### 1. **No Authentication/Authorization on Edge Functions**
**Severity:** CRITICAL  
**File:** `backend/config.toml`  
**Issue:**
```toml
[functions.suggest-meal]
verify_jwt = false

[functions.parse-menu]
verify_jwt = false
```
- Functions accept requests without JWT verification
- Anyone can call these functions and create orders for any hotel
- No authentication enforcement at function level

**Fix:** Enable JWT verification:
```toml
[functions.suggest-meal]
verify_jwt = true

[functions.parse-menu]
verify_jwt = true
```

---

### 2. **Overly Permissive CORS Headers**
**Severity:** CRITICAL  
**Files:** `backend/functions/parse-menu/index.ts`, `backend/functions/suggest-meal/index.ts`  
**Issue:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // ❌ WILDCARD - DANGEROUS
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
```
- Allows requests from ANY domain
- Enables CSRF attacks from malicious websites
- Function can be abused to create orders for any hotel

**Fix:** 
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://yourdomain.com",  // Specific domain only
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
```

---

### 3. **Plain Text PIN Storage**
**Severity:** CRITICAL  
**File:** `backend/migrations/0001_init_schema.sql`  
**Issue:**
```sql
owner_pin text not null default ''  -- ❌ Stored as plain text
```
- Owner PINs stored in plain text in database
- Stolen database = compromised owner accounts
- No way to recover if PIN is leaked

**Fix:** Hash the PIN using bcrypt or similar:
```sql
-- Add hash column
ALTER TABLE public.hotels ADD COLUMN owner_pin_hash text NOT NULL DEFAULT '';

-- Use Edge Function to hash PINs on registration
-- Store hash, not plain PIN
```

---

### 4. **Insecure Direct Object Reference (IDOR) - Menu Items**
**Severity:** CRITICAL  
**File:** `frontend/lib/api.ts`  
**Issue:**
```typescript
export async function saveMenuItem(values: MenuItemFormValues): Promise<MenuItem> {
  // Anyone can UPDATE/DELETE any menu item by knowing its ID
  const query = values.id
    ? supabase.from("menu_items").update(payload).eq("id", values.id)  // ❌ No owner check
    : supabase.from("menu_items").insert(payload).select("*").single();
}
```
- No verification that user owns the hotel
- Guests can modify menu items via direct API calls
- Can delete competitors' menu items

**Fix:** Add RLS policy to verify hotel ownership
```sql
-- Current RLS (too permissive)
create policy "Public can manage menu items" on public.menu_items for all using (true);

-- Should be:
create policy "Only hotel owner can manage their menu" on public.menu_items for all
  using (
    hotel_id IN (
      SELECT id FROM public.hotels WHERE email = auth.jwt() ->> 'email'
    )
  );
```

---

### 5. **IDOR on Hotel Details**
**Severity:** CRITICAL  
**File:** `frontend/lib/api.ts`  
**Issue:**
```typescript
export async function saveHotel(values: HotelFormValues): Promise<Hotel> {
  // Anyone can UPDATE any hotel (including changing owner PIN!)
  const { data, error } = await supabase.from("hotels").upsert(payload);
}
```
- No verification of hotel ownership
- Guests can hijack any hotel by changing email/PIN
- Can steal another owner's account

**Fix:** Restrict updates to authenticated owners only (RLS)

---

## 🟠 HIGH SEVERITY VULNERABILITIES

### 6. **Orders Can Be Modified by Anyone**
**Severity:** HIGH  
**File:** `backend/migrations/0001_init_schema.sql`, `frontend/lib/api.ts`  
**Issue:**
```sql
-- RLS allows anyone to update pending orders
create policy "Public can update pending orders" on public.orders for update
  using (status = 'pending')
  with check (status in ('pending', 'confirmed', 'cancelled'));
```
- Guests from other tables can modify any pending order
- Can change order items before confirmation
- Can tamper with pricing

**Fix:** Add order ID tracking to prevent tampering
```sql
create policy "Only order creator can update their order" on public.orders for update
  using (true)  -- Would need session tracking
  with check (status in ('pending', 'confirmed', 'cancelled'));
```

---

### 7. **No Input Validation on Owner PIN**
**Severity:** HIGH  
**File:** `frontend/lib/api.ts`  
**Issue:**
```typescript
export async function loginHotelOwner(email: string, ownerPin: string): Promise<Hotel> {
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("email", email.trim())
    .eq("owner_pin", ownerPin.trim())  // ❌ No validation
    .single();
}
```
- No brute force protection
- No rate limiting on login attempts
- Can brute force 4-digit PINs (10,000 combinations)

**Fix:** Add rate limiting and lockout mechanisms
```typescript
// Implement:
// - Rate limit: 5 attempts per minute per email
// - Account lockout: 10 failed attempts = 15 min lockout
// - Use stronger PIN requirement (min 6 digits)
```

---

### 8. **No Email Verification**
**Severity:** HIGH  
**Issue:** Owners can register with fake emails
- No verification that email is valid
- No recovery mechanism if email is wrong
- Can lead to account lockout

**Fix:** Implement email verification flow

---

### 9. **AI Function Input Not Properly Validated**
**Severity:** HIGH  
**File:** `backend/functions/suggest-meal/index.ts`  
**Issue:**
```typescript
async function suggestWithClaude(
  apiKey: string,
  menu: MenuItem[],
  body: RequestBody,
  corrective = false
): Promise<Suggestion | null> {
  const prompt = { ... menu, ... body };  // ❌ Raw data sent to Claude
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    body: JSON.stringify({
      messages: [{
        role: "user",
        content: corrective
          ? `Previous response was invalid. Try again...` 
          : JSON.stringify(prompt)  // ❌ Unescaped JSON
      }]
    })
  });
}
```
- User input (`allergies` field) sent directly to Claude
- Could allow prompt injection attacks
- API key exposed in error responses

**Fix:** Sanitize and escape all user input

---

### 10. **Weak JSON Parsing from Claude**
**Severity:** HIGH  
**File:** `backend/functions/parse-menu/index.ts`  
**Issue:**
```typescript
try {
  const parsed = JSON.parse(text);  // ❌ No schema validation
  return Array.isArray(parsed?.items) ? parsed.items : null;
} catch {
  return null;  // ❌ Silent failure
}
```
- No validation of response structure
- Claude could return invalid data
- No error logging

---

### 11. **Session Management via localStorage**
**Severity:** HIGH  
**File:** `frontend/app/dashboard/page.tsx`, `frontend/app/menu-scan/page.tsx`  
**Issue:**
```typescript
window.localStorage.setItem("tableai_hotel_id", hotelData.id);  // ❌ Plain text
```
- Hotel ID stored unencrypted in browser
- Vulnerable to XSS attacks
- No session timeout
- localStorage persists across browser sessions

**Fix:** Use secure, httpOnly cookies with short TTL

---

## 🟡 MEDIUM SEVERITY ISSUES

### 12. **Missing Input Length Limits**
**Severity:** MEDIUM  
**Files:** All form inputs  
**Issue:**
```html
<input name="name" required defaultValue={hotel?.name ?? ""} />
```
- No maxlength attribute on text inputs
- Could lead to DoS by submitting huge strings
- Database field size not enforced

**Fix:** Add constraints to all text inputs:
```html
<input name="name" required maxLength={100} defaultValue={hotel?.name ?? ""} />
```

---

### 13. **No Price/Budget Decimal Handling**
**Severity:** MEDIUM  
**File:** `frontend/lib/types.ts`  
**Issue:**
```typescript
export type MenuItem = {
  price: number;  // ❌ Float precision issues
};
```
- Floating point arithmetic causes precision loss
- Budget calculations could be off by pennies
- Should use integers (store in paise, not rupees)

**Fix:** Use DECIMAL type in database and integers in code:
```typescript
price: number;  // Store as paise (e.g., 32000 for ₹320)
```

---

### 14. **Missing API Rate Limiting**
**Severity:** MEDIUM  
**Issue:** No rate limiting on functions
- Users can spam order creation
- Parse-menu can be abused
- No protection against DoS

**Fix:** Implement rate limiting in Edge Functions
```typescript
const RATE_LIMIT = 10;  // 10 requests per minute
// Use Deno KV or similar
```

---

### 15. **Hardcoded Demo Hotel ID**
**Severity:** MEDIUM  
**File:** `frontend/app/order/OrderClient.tsx`  
**Issue:**
```typescript
const demoHotelId = "11111111-1111-1111-1111-111111111111";
```
- Exposes demo hotel to public
- Demo PIN "1234" is in seed.sql
- Anyone can access and modify demo data

**Fix:** Restrict demo access or use separate demo environment

---

### 16. **No Transaction Handling**
**Severity:** MEDIUM  
**Issue:** Multi-step operations not atomic
```typescript
// Example: Order creation
const order = await createOrder(...);  // Step 1
const menu = await updateMenuAvailability(...);  // Step 2
// If Step 2 fails, Step 1 is committed (inconsistent state)
```

**Fix:** Wrap in database transactions

---

### 17. **Error Messages Expose System Details**
**Severity:** MEDIUM  
**Files:** API error responses  
**Issue:**
```typescript
return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
```
- Returns raw database error messages
- Could expose SQL structure
- Helps attackers understand system

**Fix:** Return generic error messages in production:
```typescript
return json({ error: "Unable to process request" }, 400);
```

---

### 18. **Missing CSRF Protection**
**Severity:** MEDIUM  
**Issue:** No CSRF tokens on form submissions
- Forms can be submitted from external sites
- State-changing operations not protected

**Fix:** Implement CSRF tokens in all forms

---

## 🔵 LOW SEVERITY / CODE QUALITY ISSUES

### 19. **Missing Input Sanitization**
**Issue:** User data should be sanitized before display
```typescript
<p className="font-semibold text-ink">{item.name}</p>  // Could contain HTML
```

**Fix:** Use React's built-in escaping (already done by React) or sanitize

---

### 20. **No Request/Response Logging**
**Issue:** No audit trail for operations
- Can't debug issues
- No security incident tracking
- Compliance issues

**Fix:** Implement logging:
```typescript
console.log(`[${new Date().toISOString()}] User ${email} accessed hotel ${hotelId}`);
```

---

### 21. **Missing Environment Variable Validation**
**Severity:** LOW  
**File:** `frontend/lib/supabase.ts`  
**Issue:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;  // No validation
```

**Fix:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
  throw new Error("Invalid SUPABASE_URL");
}
```

---

### 22. **No Concurrency Control**
**Issue:** Simultaneous edits could cause data loss
- Two owners editing same hotel at same time
- Last write wins (no conflict detection)

**Fix:** Implement optimistic locking or timestamps

---

### 23. **Missing Indexes for Performance**
**Severity:** LOW  
**Issue:** Email lookup on login not indexed
```sql
-- Add:
CREATE INDEX idx_hotels_email ON public.hotels(email);
```

---

### 24. **No Database Backups Policy**
**Severity:** MEDIUM  
**Issue:** No mention of backup strategy
- Data loss risk
- Recovery time undefined

---

### 25. **Anthropic API Key Exposure Risk**
**Severity:** HIGH  
**File:** `backend/functions/suggest-meal/index.ts`  
**Issue:**
```typescript
const apiKey = Deno.env.get("ANTHROPIC_API_KEY");  // Could leak in error responses
const response = await fetch("https://api.anthropic.com/v1/messages", {
  headers: { "x-api-key": apiKey }  // In production logs?
});
```

**Fix:**
- Never log API keys
- Use request ID tracking instead
- Implement API key rotation

---

## 📊 SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 6 | ⚠️ Must fix immediately |
| 🟠 HIGH | 5 | ⚠️ Fix before production |
| 🟡 MEDIUM | 8 | ⚠️ Fix soon |
| 🔵 LOW | 6 | ℹ️ Nice to have |
| **TOTAL** | **25** | |

---

## ⚡ PRIORITY FIXES (DO FIRST)

1. ✅ Enable JWT verification on Edge Functions
2. ✅ Replace wildcard CORS with specific domain
3. ✅ Implement owner verification in RLS policies
4. ✅ Hash PINs in database
5. ✅ Add rate limiting to login/API endpoints
6. ✅ Use secure cookies instead of localStorage
7. ✅ Validate all user inputs with length limits
8. ✅ Add email verification flow

---

## 📋 DEPLOYMENT CHECKLIST

- [ ] All CRITICAL issues fixed
- [ ] JWT verification enabled
- [ ] RLS policies restrict access properly
- [ ] PINs are hashed
- [ ] CORS headers specific to domain
- [ ] Rate limiting implemented
- [ ] Error messages are generic in production
- [ ] Environment variables validated
- [ ] Logging implemented
- [ ] Backup strategy in place
- [ ] Security headers added (CSP, X-Frame-Options, etc.)
- [ ] HTTPS enforced
- [ ] Secrets manager configured (not hardcoded)

---

## 🛠️ NEXT STEPS

1. **Week 1:** Fix all CRITICAL issues
2. **Week 2:** Fix all HIGH severity issues
3. **Week 3:** Implement MEDIUM and LOW priority fixes
4. **Week 4:** Security testing and penetration testing
5. **Week 5:** Production deployment with monitoring
