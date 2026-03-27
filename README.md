# Zorachat

Zorachat is a mobile-first chat app prototype built with Expo and React Native.

It includes:

- account creation and login by email
- local multi-user testing on one device
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
- AsyncStorage for local persistence

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

3. Start the Expo server:

```bash
npm start
```

4. Open the app:

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
```

## Notes

- App data is stored locally on device using AsyncStorage
- `Reset All Local Data` removes all saved accounts, requests, and chats
- The current in-app branding is Zorachat

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
