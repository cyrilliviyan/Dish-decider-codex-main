# TableAI - Code Quality & Architecture Issues

## 🏗️ ARCHITECTURAL ISSUES

### 1. **Missing Authentication Architecture**
**Current State:** No user authentication system  
**Issue:** All operations are public with optional RLS  
**Impact:** Anyone can impersonate anyone else  

**Solution:**
- Implement Supabase Auth with email/password
- Add role-based access control (RBAC)
- Separate owner portal from guest portal auth flows

```typescript
// Example flow
const { data, error } = await supabase.auth.signUp({
  email: formData.get("email"),
  password: formData.get("password"),
  options: {
    data: { role: "hotel_owner" }
  }
});
```

---

### 2. **Session Management is Broken**
**Current State:** localStorage + URL parameters  
**Issues:**
- No proper session lifecycle
- No session timeout
- XSS vulnerability
- Multiple device sessions not tracked

**Better Approach:**
```typescript
// Use secure cookies with proper session management
// Session should:
// - Expire after 24 hours of inactivity
// - Be invalidated on logout
// - Support multiple concurrent sessions
// - Track user agent for security
```

---

### 3. **No Data Consistency Guarantees**
**Issue:** Multi-step operations can leave data in inconsistent states

Example:
```typescript
// Step 1: Create order
const order = await supabase.from("orders").insert({...});

// Step 2: Update menu availability
await supabase.from("menu_items").update({is_available: false});

// If step 2 fails, order exists but menu not updated
```

**Solution:** Use database transactions
```sql
BEGIN;
  INSERT INTO orders ...;
  UPDATE menu_items ...;
COMMIT; -- Or ROLLBACK on error
```

---

### 4. **No Audit Trail**
**Issue:** No way to track who did what and when  
**Impact:** Can't debug issues or prove who modified data

**Solution:** Create audit table
```sql
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  action text NOT NULL,  -- 'create', 'update', 'delete'
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Add trigger to auto-log changes
```

---

### 5. **No Versioning or Rollback Strategy**
**Issue:** Migrations can't be rolled back  
**Solution:** Implement proper migration versioning

```bash
# Current structure
backend/migrations/
  0001_init_schema.sql
  0002_hash_owner_pins.sql
  
# Better structure
backend/migrations/
  up/
    0001_init_schema.sql
    0002_hash_owner_pins.sql
  down/  # Rollback scripts
    0002_hash_owner_pins.sql
    0001_init_schema.sql
```

---

## 🐛 CODE QUALITY ISSUES

### 6. **Inconsistent Error Handling**
**Issue:** Mix of try-catch, error returns, and silent failures

```typescript
// In parse-menu/index.ts - Silent failure
try {
  const parsed = JSON.parse(text);
  return Array.isArray(parsed?.items) ? parsed.items : null;
} catch {
  return null;  // ❌ No logging
}

// In suggest-meal/index.ts - Throws error
if (!anthropicApiKey) {
  throw new Error("...");  // Inconsistent
}
```

**Solution:** Standardize error handling
```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

// Consistent usage
if (!apiKey) {
  throw new AppError(500, "API key not configured", true, {
    context: "parseMenu"
  });
}
```

---

### 7. **Type Safety Issues**
**Issue:** Too many `any` types and unsafe type casts

```typescript
// Unsafe
const data = await response.json() as Suggestion;
const allItems = [...(suggestion.starters ?? []), ...];

// Better
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const response = await fetch(...);
const result: ApiResponse<Suggestion> = await response.json();
if (!result.success || !result.data) throw new Error(...);
```

---

### 8. **Missing Input Validation Layer**
**Issue:** Validation scattered throughout code

```typescript
// In suggest-meal
function validateRequest(body: RequestBody) {
  if (!body.hotel_id) throw new Error("hotel_id is required.");
  if (!Number.isFinite(body.party_size) || body.party_size < 1) throw new Error("party_size must be at least 1.");
  // ... more validation
}

// Repeated in multiple places
```

**Solution:** Use validation library
```typescript
import { z } from "zod";

const RequestBodySchema = z.object({
  hotel_id: z.string().uuid(),
  party_size: z.number().int().min(1),
  budget: z.number().positive(),
  veg_pref: z.enum(["veg", "non_veg", "mixed"]),
  spice_pref: z.enum(["mild", "medium", "hot"]),
  allergies: z.string().max(500).optional()
});

const validatedBody = RequestBodySchema.parse(body);
```

---

### 9. **No Testing Infrastructure**
**Issue:** No unit tests, integration tests, or e2e tests  
**Impact:** Can't safely refactor, high bug risk

**Solution:** Add test suite
```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react

# Create test structure
frontend/
  __tests__/
    api.test.ts
    components/
      OrderForm.test.tsx

# Write tests
describe("loginHotelOwner", () => {
  it("should return hotel on valid credentials", async () => {
    // ...
  });
  
  it("should throw on invalid PIN", async () => {
    // ...
  });
});
```

---

### 10. **Duplicate Code in Frontend**
**Issue:** Same form logic repeated

```typescript
// dashboard/page.tsx - HotelForm component
function HotelForm({ hotel, loading, onSubmit }: {...}) { ... }

// register/page.tsx - Same component
function HotelForm({ hotel, loading, onSubmit }: {...}) { ... }
```

**Solution:** Extract to shared component
```bash
frontend/
  components/
    forms/
      HotelForm.tsx  # Shared
      MenuForm.tsx   # Shared
      OrderForm.tsx  # Shared
```

---

### 11. **No Environment Configuration**
**Issue:** Hardcoded values scattered everywhere

```typescript
// frontend/app/order/OrderClient.tsx
const demoHotelId = "11111111-1111-1111-1111-111111111111";
const location = ["Tambaram", "Velachery", ...];
const HotelName = ["Kaadai king", ...];
```

**Solution:** Use config file
```typescript
// frontend/config.ts
export const CONFIG = {
  demo: {
    hotelId: process.env.NEXT_PUBLIC_DEMO_HOTEL_ID,
    locations: process.env.NEXT_PUBLIC_DEMO_LOCATIONS?.split(",") || [],
  },
  api: {
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
  },
  limits: {
    maxTextLength: 1000,
    maxNameLength: 100,
    rateLimit: 10,  // requests per minute
  }
};
```

---

### 12. **No Dependency Injection**
**Issue:** Functions tightly coupled to dependencies

```typescript
// Hard to test - creates own Supabase client
export async function fetchHotel(hotelId: string): Promise<Hotel | null> {
  const { data, error } = await supabase.from("hotels")...
}
```

**Better approach:**
```typescript
export async function fetchHotel(
  hotelId: string,
  client: SupabaseClient = supabase
): Promise<Hotel | null> {
  const { data, error } = await client.from("hotels")...
}

// Easy to test with mock
test("fetchHotel", async () => {
  const mockClient = createMockSupabaseClient();
  await fetchHotel("123", mockClient);
});
```

---

### 13. **Inconsistent Naming Conventions**
**Issue:** Mix of camelCase and snake_case

```typescript
// API uses snake_case
owner_name, mobile_number, veg_flag, is_available

// Frontend uses camelCase
ownerName, mobileNumber, vegFlag, isAvailable

// Mixed in one place
const { owner_pin, owner_name } = hotelData;  // snake_case
const payload = { ownerPin: data }  // camelCase
```

**Solution:** Standardize throughout:
- Database: snake_case
- Backend functions: camelCase
- Frontend: camelCase
- API contract: Consistent transformation layer

```typescript
// Mapper to convert between formats
const dbToApi = (dbRecord: DbHotel): ApiHotel => ({
  id: dbRecord.id,
  name: dbRecord.name,
  ownerName: dbRecord.owner_name,  // Transform
  // ...
});
```

---

### 14. **No Loading States in Some Components**
**Issue:** Inconsistent UX during async operations

```typescript
// OrderClient has proper loading states
const [loading, setLoading] = useState(false);

// But some forms don't prevent multiple submissions
<button onClick={handleSuggest} disabled={loading}>
  Get AI combo
</button>

// Double-submit possible if user clicks twice quickly
```

**Solution:** Disable all buttons during operation
```typescript
<button disabled={loading || confirming} onClick={handleConfirm}>
  {confirming ? "Confirming..." : "Confirm"}
</button>
```

---

## 📊 CODE METRICS

### Complexity Analysis
```
File                           Lines  Cyclomatic  Status
------------------------------------------------------
backend/functions/suggest-meal 250    High        ⚠️ Refactor
frontend/lib/api.ts            200    Medium      ✅ OK
frontend/app/dashboard/page    400    High        ⚠️ Split component
```

### Test Coverage
```
Current: 0%
Target:  80%+
```

---

## 🔄 REFACTORING ROADMAP

### Phase 1: Security (Week 1-2)
- [ ] Fix JWT verification
- [ ] Hash PINs
- [ ] Fix RLS policies
- [ ] Add rate limiting

### Phase 2: Architecture (Week 3-4)
- [ ] Add proper authentication
- [ ] Implement session management with cookies
- [ ] Add transaction support
- [ ] Create audit trail

### Phase 3: Code Quality (Week 5-6)
- [ ] Add input validation layer (Zod)
- [ ] Standardize error handling
- [ ] Extract shared components
- [ ] Add configuration management
- [ ] Implement dependency injection

### Phase 4: Testing (Week 7-8)
- [ ] Unit tests (api, utils)
- [ ] Component tests (React components)
- [ ] Integration tests (API + DB)
- [ ] E2E tests (full flows)

### Phase 5: Monitoring (Week 9)
- [ ] Add structured logging
- [ ] Implement error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Create dashboards

---

## 📚 RECOMMENDED DEPENDENCIES

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react": "^14.0.0",
    "typescript": "^5.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "prettier": "^3.0.0",
    "husky": "^8.0.0"
  },
  "dependencies": {
    "zod": "^3.22.0",
    "next": "^14.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.2.0"
  }
}
```

---

## 📋 CODE STYLE GUIDE

### ESLint + Prettier Config

**.eslintrc.json:**
```json
{
  "extends": ["next/core-web-vitals", "prettier"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-return-types": "error",
    "no-console": ["error", { "allow": ["warn", "error"] }]
  }
}
```

**.prettierrc:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## 🚀 DEPLOYMENT READINESS CHECKLIST

### Code Quality
- [ ] All TypeScript errors fixed
- [ ] ESLint passes with no errors
- [ ] Test coverage > 80%
- [ ] No `any` types used
- [ ] No `console.log` in production code

### Security
- [ ] All CRITICAL vulnerabilities fixed
- [ ] All HIGH severity fixes applied
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] Rate limiting enabled

### Operations
- [ ] Logging configured
- [ ] Error tracking (Sentry) setup
- [ ] Database backups automated
- [ ] Monitoring/alerting configured
- [ ] Runbooks written

### Documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] Incident response plan
- [ ] Architecture diagrams
- [ ] Troubleshooting guide

