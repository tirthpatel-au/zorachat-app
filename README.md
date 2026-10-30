# Velora

Velora is a mobile-first chat app built with Expo and React Native.

Live demo: https://tirthpatel-au.github.io/velora-app/

It includes:

- account creation and login by email and password
- shared local backend for multi-device testing
- friend search by exact email
- friend request sending and accepting
- one-to-one chat threads
- unread message badges and popup unread summary
- profile editing and logout
- smooth loading overlays for key actions

## Tech Stack

- Expo SDK 54
- React Native
- TypeScript
- Node HTTP server with a JSON database for shared local persistence

## Run Locally

1. Clone the repo:

```bash
git clone https://github.com/tirthpatel-au/zorachat-app.git
cd zorachat-app
```

2. Install dependencies:

```bash
npm install
```

3. Start the shared backend in one terminal:

```bash
npm run server
```

4. Start the Expo server in another terminal:

```bash
npm start
```

For a production-style web build:

```bash
npm run export:web
```

5. Open the app:

- On phone: scan the QR code in Expo Go
- On desktop web: press `w` in the Expo terminal or run `npm run web`

## Test Flow

1. Create account for user 1
2. Logout
3. Create account for user 2
4. Logout
5. Login as user 1
6. Open `Friends`
7. Search user 2 by exact email
8. Send friend request
9. Logout
10. Login as user 2
11. Accept request
12. Open `Chats`
13. Tap the chat row to open the full conversation

## Scripts

```bash
npm start
npm run android
npm run ios
npm run web
npm run export:web
npm run deploy
npm run server
```

## Notes

- The shared backend stores runtime data in `data/store.json`, which is intentionally ignored by Git because it can contain test passwords and account data.
- `data/store.example.json` documents the database shape without including credentials.
- Web uses `http://localhost:3100` by default. Android emulator uses `http://10.0.2.2:3100`.
- For Expo Go on a real phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN address before starting Expo, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:3100 npm start`.
- The current in-app branding is Velora.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
