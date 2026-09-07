# Mobile app: local development

## Start the API and app

From the repository root, keep Docker Desktop running, start the API in one
terminal and Expo in another:

```powershell
pnpm api:dev
pnpm mobile:start
```

The mobile app uses `EXPO_PUBLIC_API_URL` from `apps/mobile/.env`. Copy the
template before first use:

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

## Choose the correct API address

| Where the app runs                                | `EXPO_PUBLIC_API_URL` value        |
| ------------------------------------------------- | ---------------------------------- |
| Web browser or iOS simulator on the same computer | `http://localhost:3000`            |
| Android emulator on this Windows computer         | `http://10.0.2.2:3000`             |
| Expo Go on a physical phone                       | `http://YOUR-COMPUTER-LAN-IP:3000` |

For a physical phone, connect the phone and computer to the same Wi-Fi network.
Find the computer LAN IPv4 address with `ipconfig`, for example
`http://192.168.1.25:3000`. Do not use real personal data or passwords in the
test app.

If the phone cannot connect, permit Node.js through the Windows private-network
firewall prompt, verify that the API terminal is running, and check the address
in `apps/mobile/.env`. Restart Expo after changing that file.

## Current screens

- Welcome and onboarding
- Registration with email, password, city and the 16+ test-beta acknowledgement
- Login and secure token restoration
- Editable profile with city picker
- A signed-in placeholder home screen until the feed is added in Batch 7

Sessions use the device secure storage on Android/iOS. The web build uses the
browser's local storage for local development only; do not treat it as an
equivalent security boundary.
