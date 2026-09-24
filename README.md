# Employee System

Expo/React Native employee CRUD app connected to the Freehostia PHP API and DummyJSON Quotes API.

## Dual APIs

- Custom API: `http://kertabajo.mooo.com/employees` handles employee GET, POST, PUT, and DELETE operations.
- External API: `https://dummyjson.com/quotes/random` supplies the Team Inspiration card. It requires no API key.

## Run with Expo Go

```powershell
npm install
npx expo start
```

Scan the QR code with Expo Go. The phone needs internet access because the app uses the hosted API.

## API setup

1. Upload `backend/employees.php` and `backend/.htaccess` to the same Freehostia folder as `connection.php`, replacing the old `employees.php`.
2. Keep the real `connection.php` private and replace its database password after the credential was exposed.
3. Do not include the old `auth.php` comment block in the API response. The endpoint must return JSON beginning with `[` or `{`, not `/* */`.
4. Confirm that `http://kertabajo.mooo.com/employees` returns JSON in a browser.
5. Change `src/config.js` if the API URL is different.

The API must accept the fields `firstname`, `middlename`, `lastname`, `position`, `department`, `email`, and `phone`. The included backend version uses prepared statements and supports all seven fields.

The current Freehostia HTTPS endpoint is not responding, so the classroom configuration uses HTTP. HTTP is not suitable for a public production app because employee data is sent unencrypted.

## Build an APK

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

The `preview` profile is configured to produce an installable APK. Do not put database passwords or API tokens in the Expo app.
