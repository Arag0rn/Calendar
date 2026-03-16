# Google Calendar Integration Setup

## 1. Отримай Google Client ID

1. Перейди на https://console.cloud.google.com
2. Створи новий проект
3. Включи **Google Calendar API** та **Google Meet API**
4. Перейди до OAuth > Credentials
5. Створи "OAuth 2.0 Client ID" для Web application
6. Додай `http://localhost:3000` та `http://localhost:3001` в "Authorized redirect URIs"
7. Скопіюй Client ID

## 2. Добавь в .env.local

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=ТВІ_CLIENT_ID_ТУТ
```

## 3. Готово!
