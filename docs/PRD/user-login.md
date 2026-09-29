# PRD: User Login Screen

## 1. Overview
The Login screen allows existing users to authenticate into the GeoNexo application. It collects credentials (email and password) and, upon successful validation, redirects the user to the Dashboard.

## 2. User Goals
- Securely sign in to access personal projects and data.
- Recover forgotten password via a "Forgot password?" link.
- Navigate to sign‑up if they do not yet have an account.

## 3. UI Layout (Desktop & Mobile)
```
+---------------------------------------------------+
|                  GeoNexo Logo                     |
|                                                   |
|  ┌─────────────────────────────────────────────┐  |
|  │               Sign In to GeoNexo            │  |
|  └─────────────────────────────────────────────┘  |
|                                                   |
|  Email:  [_______________________________]        |
|                                                   |
|  Password: [_______________________________] [👁] |
|                                                   |
|  [  Sign In Button  ] (primary, full‑width)       |
|                                                   |
|  Forgot password?                                 |
|                                                   |
|  Don’t have an account?  Sign up                  |
+---------------------------------------------------+
```

* The logo is centered at the top.
* Form fields are stacked vertically with appropriate labels.
* The password field includes a toggle icon (`👁`) to show/hide text.
* The "Sign In" button is disabled until both fields pass basic client‑side validation (non‑empty, email format).
* Links are styled as inline text.

## 4. Components & Behaviors
| Element          | Type          | Behavior |
|------------------|---------------|----------|
| Email input      | `<input type="email">` | Triggers validation on blur; shows inline error if invalid. |
| Password input   | `<input type="password">` | Toggle button switches between `password` and `text`. |
| Show/Hide icon   | Button (icon-only) | On click, toggles password field type and icon (eye / eye‑slash). |
| Sign In button   | `<button>` | Calls `/api/v1/auth/login` (POST) with `{email, password}`. On success stores JWT in httpOnly cookie / localStorage and redirects to `/dashboard`. On error displays server‑returned message (e.g., invalid credentials). |
| Forgot password? | Link (`<a>`) | Navigates to `/forgot-password`. |
| Sign up link     | Link (`<a>`) | Navigates to `/sign-up`. |

## 5. Validation Rules
- **Email**: required, must match RFC‑5322 pattern (simple regex: `^[^\s@]+@[^\s@]+\.[^\s@]+$`).
- **Password**: required, minimum 8 characters.
- Client‑side validation prevents submission until both pass.
- Server returns:
  * `400` with `{ error: { code: 'VALIDATION_ERROR', ... } }` for malformed input.
  * `401` with `{ error: { code: 'INVALID_CREDENTIALS', ... } }` for wrong email/password.
  * `500` for unexpected errors.

## 6. Loading & Error States
* While the login request is in flight, the Sign In button shows a spinner and is disabled.
* On error, an alert banner appears below the form with the message from the response (or a generic “Unable to sign in”).

## 7. Accessibility
* All form fields have associated `<label>` elements.
* Sufficient contrast (WCAG AA) for text and icons.
* Keyboard navigable: Tab order follows visual order; Enter triggers sign‑in when focused on any field.
* ARIA live region for error messages.

## 8. Analytics / Tracking
* Track "login_attempt" event (success/failure) with email (hashed) and timestamp.
* Track "forgot_password_click" and "sign_up_click".

## 9. Open Questions
- Should we support social login (Google/GitHub) in the future? If yes, placeholders for buttons can be added.
- Should we implement "Remember me" (persistent token) – currently session cookie suffices.

---