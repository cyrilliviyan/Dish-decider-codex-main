# TableAI - Security Remediation Guide

## Quick Reference: Critical Fixes

### Issue #1: Enable JWT Verification on Edge Functions

**File:** `backend/config.toml`

```diff
[functions.suggest-meal]
- verify_jwt = false
+ verify_jwt = true

[functions.parse-menu]
- verify_jwt = false
+ verify_jwt = true
```

---

### Issue #2: Fix CORS Headers

**File:** `backend/functions/suggest-meal/index.ts`

```diff
const corsHeaders = {
-  "Access-Control-Allow-Origin": "*",
+  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://yourdomain.com",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
   "Access-Control-Allow-Methods": "POST, OPTIONS"
};
```

**File:** `backend/functions/parse-menu/index.ts`

```diff
const corsHeaders = {
-  "Access-Control-Allow-Origin": "*",
+  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://yourdomain.com",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
   "Access-Control-Allow-Methods": "POST, OPTIONS"
};
```

---

### Issue #3: Hash PINs - Database Migration

**New File:** `backend/migrations/0002_hash_owner_pins.sql`

```sql
-- Step 1: Add new column for hashed PIN
ALTER TABLE public.hotels ADD COLUMN owner_pin_hash text;

-- Step 2: Migrate existing PINs (WARNING: One-time operation)
-- For demo purposes only - use a proper hash function in production
-- In production, use a backend function to hash:
UPDATE public.hotels 
SET owner_pin_hash = crypt(owner_pin, gen_salt('bf', 8))
WHERE owner_pin IS NOT NULL;

-- Step 3: Make hash required
ALTER TABLE public.hotels ALTER COLUMN owner_pin_hash SET NOT NULL;

-- Step 4: Drop old PIN column
ALTER TABLE public.hotels DROP COLUMN owner_pin;

-- Step 5: Rename hash column
ALTER TABLE public.hotels RENAME COLUMN owner_pin_hash TO owner_pin;
```

**Update API:** `frontend/lib/api.ts`

```typescript
// Never save PIN directly - let Edge Function hash it
export async function registerHotel(hotelData: HotelFormValues): Promise<Hotel> {
  // Send PIN to secure endpoint that hashes it
  const { data, error } = await supabase.functions.invoke("register-hotel", {
    body: hotelData
  });
  
  if (error) throw new Error(error.message);
  return data;
}

// For login, send plain PIN - Edge Function compares hash
export async function loginHotelOwner(email: string, ownerPin: string): Promise<Hotel> {
  const { data, error } = await supabase.functions.invoke("login-hotel", {
    body: { email: email.trim(), owner_pin: ownerPin.trim() }
  });
  
  if (error) throw new Error("Hotel login failed. Check email and PIN.");
  return data;
}
```

**New Edge Function:** `backend/functions/register-hotel/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://yourdomain.com",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type"
      }
    });
  }

  try {
    const body = await request.json();
    
    // Validate input
    if (!body.email || !body.owner_pin) {
      throw new Error("Email and PIN required");
    }
    
    if (body.owner_pin.length < 4) {
      throw new Error("PIN must be at least 4 digits");
    }

    // Hash the PIN
    const hashedPin = await bcrypt.hash(body.owner_pin);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Create/update hotel with hashed PIN
    const { data, error } = await supabase
      .from("hotels")
      .upsert({
        id: body.id || undefined,
        name: body.name,
        location: body.location,
        owner_name: body.ownerName,
        mobile_number: body.mobileNumber,
        email: body.email,
        owner_pin: hashedPin,  // Store hash, not plain text
        currency: body.currency || "INR"
      })
      .select("*")
      .single();

    if (error) throw error;

    // Return hotel WITHOUT pin
    const { owner_pin, ...safeHotel } = data;
    return new Response(JSON.stringify(safeHotel), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

### Issue #4: Fix RLS Policies - Owner Verification

**File:** `backend/migrations/0003_fix_rls_policies.sql`

```sql
-- Drop old permissive policies
DROP POLICY IF EXISTS "Public can manage hotels" ON public.hotels;
DROP POLICY IF EXISTS "Public can manage menu items" ON public.menu_items;

-- Hotels: Only owner can update their hotel
CREATE POLICY "Hotel owner can view their hotel"
  ON public.hotels FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Hotel owner can update their hotel"
  ON public.hotels FOR UPDATE
  USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

-- Public can still read hotels (for guest page)
CREATE POLICY "Public can read hotels"
  ON public.hotels FOR SELECT
  USING (true);

-- Menu items: Only hotel owner can manage
CREATE POLICY "Only hotel owner can manage menu"
  ON public.menu_items FOR ALL
  USING (
    hotel_id IN (
      SELECT id FROM public.hotels 
      WHERE auth.jwt() ->> 'email' = email
    )
  )
  WITH CHECK (
    hotel_id IN (
      SELECT id FROM public.hotels 
      WHERE auth.jwt() ->> 'email' = email
    )
  );

-- Public can only read available items
CREATE POLICY "Public can read available items"
  ON public.menu_items FOR SELECT
  USING (is_available = true);

-- Orders: Guests can create, admin can view all
CREATE POLICY "Public can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Hotel owner can view their orders"
  ON public.orders FOR SELECT
  USING (
    hotel_id IN (
      SELECT id FROM public.hotels 
      WHERE auth.jwt() ->> 'email' = email
    )
  );
```

---

### Issue #5: Rate Limiting on Login

**New Edge Function:** `backend/functions/rate-limit-middleware/index.ts`

```typescript
// Implement using Deno KV
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;

export async function checkRateLimit(key: string): Promise<boolean> {
  const kv = await Deno.openKv();
  const now = Date.now();
  
  const attempts = await kv.get([`rate_limit`, key]);
  
  if (!attempts.value) {
    await kv.set([`rate_limit`, key], { count: 1, timestamp: now }, {
      expireIn: RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  const { count, timestamp } = attempts.value as any;
  
  if (now - timestamp > RATE_LIMIT_WINDOW) {
    await kv.set([`rate_limit`, key], { count: 1, timestamp: now }, {
      expireIn: RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  if (count >= MAX_ATTEMPTS) {
    return false;
  }
  
  await kv.set([`rate_limit`, key], { count: count + 1, timestamp }, {
    expireIn: RATE_LIMIT_WINDOW
  });
  
  return true;
}
```

**Update login function:**

```typescript
export async function loginHotelOwner(email: string, ownerPin: string): Promise<Hotel> {
  const isAllowed = await checkRateLimit(`login:${email}`);
  
  if (!isAllowed) {
    throw new Error("Too many login attempts. Please try again in 15 minutes.");
  }
  
  // ... rest of login logic
}
```

---

### Issue #6: Use Secure Cookies Instead of localStorage

**File:** `frontend/lib/supabase.ts`

```typescript
// Replace localStorage with cookies
import { cookies } from "next/headers";

export async function saveHotelSession(hotelId: string) {
  const cookieStore = cookies();
  cookieStore.set("hotel_session", hotelId, {
    httpOnly: true,        // Not accessible from JS
    secure: true,          // HTTPS only
    sameSite: "strict",    // CSRF protection
    maxAge: 60 * 60 * 24 * 7  // 7 days
  });
}

export async function getHotelSession(): string | null {
  const cookieStore = cookies();
  return cookieStore.get("hotel_session")?.value || null;
}

export async function clearHotelSession() {
  const cookieStore = cookies();
  cookieStore.delete("hotel_session");
}
```

---

### Issue #7: Input Validation and Length Limits

**File:** `frontend/app/dashboard/page.tsx`

```diff
- <input name="name" required defaultValue={hotel?.name ?? ""} placeholder="Hotel name" className="h-11 rounded-md border border-ink/15 px-3" />
+ <input name="name" required maxLength={100} defaultValue={hotel?.name ?? ""} placeholder="Hotel name" className="h-11 rounded-md border border-ink/15 px-3" />

- <input name="location" required defaultValue={hotel?.location ?? ""} placeholder="Location" className="h-11 rounded-md border border-ink/15 px-3" />
+ <input name="location" required maxLength={150} defaultValue={hotel?.location ?? ""} placeholder="Location" className="h-11 rounded-md border border-ink/15 px-3" />

- <input name="email" type="email" required defaultValue={hotel?.email ?? ""} placeholder="Email" className="h-11 rounded-md border border-ink/15 px-3" />
+ <input name="email" type="email" required maxLength={100} defaultValue={hotel?.email ?? ""} placeholder="Email" className="h-11 rounded-md border border-ink/15 px-3" />

- <textarea name="allergies" rows={3} placeholder="Optional, e.g. nuts, shellfish, dairy" className="w-full resize-none rounded-md border border-ink/15 bg-white px-3 py-3 outline-none ring-leaf/20 focus:border-leaf focus:ring-4" />
+ <textarea name="allergies" rows={3} maxLength={500} placeholder="Optional, e.g. nuts, shellfish, dairy" className="w-full resize-none rounded-md border border-ink/15 bg-white px-3 py-3 outline-none ring-leaf/20 focus:border-leaf focus:ring-4" />
```

---

### Issue #8: Sanitize and Escape AI Input

**File:** `backend/functions/suggest-meal/index.ts`

```typescript
function sanitizeInput(text: string): string {
  return text
    .trim()
    .substring(0, 1000)  // Limit length
    .replace(/[<>\"']/g, "")  // Remove dangerous chars
    .replace(/\n\n+/g, "\n");  // Remove multiple newlines
}

async function suggestWithClaude(...): Promise<Suggestion | null> {
  const prompt = {
    party_size: body.party_size,
    budget: body.budget,
    veg_pref: body.veg_pref,
    spice_pref: body.spice_pref,
    allergies: sanitizeInput(body.allergies || "none"),  // ✅ Sanitized
    menu: menu.map(({ id, name, category, price, veg_flag, spice_level, serves_count, must_try }) => ({
      id,
      name,
      category,
      price,
      veg_flag,
      spice_level,
      serves_count,
      must_try
    }))
  };
  
  // Send sanitized data
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    body: JSON.stringify({
      messages: [{
        role: "user",
        content: JSON.stringify(prompt)  // Properly escaped by JSON.stringify
      }]
    })
  });
}
```

---

### Issue #9: Add Logging Without Exposing Secrets

**File:** `backend/functions/suggest-meal/index.ts`

```typescript
function logSecure(action: string, details: Record<string, any>) {
  const safeDetails = {
    ...details,
    // Remove sensitive fields
    api_key: details.api_key ? "[REDACTED]" : undefined,
    owner_pin: details.owner_pin ? "[REDACTED]" : undefined
  };
  
  console.log(`[${new Date().toISOString()}] ${action}:`, JSON.stringify(safeDetails));
}

serve(async (request) => {
  try {
    const body = await request.json();
    validateRequest(body);
    
    logSecure("suggest-meal-request", {
      hotel_id: body.hotel_id,
      party_size: body.party_size,
      budget: body.budget,
      timestamp: new Date().toISOString()
    });
    
    // ... rest of function
  } catch (error) {
    logSecure("suggest-meal-error", {
      error_message: error instanceof Error ? error.message : "Unknown",
      timestamp: new Date().toISOString()
    });
  }
});
```

---

### Issue #10: Add Security Headers in Next.js

**File:** `frontend/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

---

## Deployment Environment Variables

**Create `.env.production`:**

```bash
# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ALLOWED_ORIGIN=https://yourdomain.com

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key-here
```

**NEVER commit `.env.local` or `.env.production` to git!**

Add to `.gitignore`:
```
.env
.env.local
.env.production
.env.*.local
```

---

## Testing Checklist

- [ ] Login rate limiting works (try 5+ failed attempts)
- [ ] Owner PIN hashing verified
- [ ] JWT verification enabled (try calling functions without auth)
- [ ] CORS only allows your domain
- [ ] RLS policies prevent owner hijacking
- [ ] localStorage no longer used for session
- [ ] Input length limits enforced
- [ ] Security headers present in response
- [ ] API returns generic error messages
- [ ] Logging doesn't expose secrets

