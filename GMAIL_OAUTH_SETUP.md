# Настройка Gmail OAuth2 для отправки писем

## 📋 Требуемые шаги

### Шаг 1: Создайте OAuth2 Client ID

1. Откройте [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Проект: `constructor-488411`
3. Нажмите **"+ Create Credentials"** → **"OAuth 2.0 Client ID"**
4. Выберите **"Desktop application"**
5. Скопируйте:
   - **Client ID**
   - **Client Secret**

### Шаг 2: Получите Refresh Token

1. Установите пакет `open`:
   ```bash
   npm install open
   ```

2. Отредактируйте файл `get-refresh-token.js`:
   - Строка 11: Замените `YOUR_CLIENT_ID_HERE` на ваш Client ID
   - Строка 12: Замените `YOUR_CLIENT_SECRET_HERE` на ваш Client Secret

3. Запустите скрипт:
   ```bash
   node get-refresh-token.js
   ```

4. **В браузере откроется окно Google Login:**
   - Войдите в `habuzovs@gmail.com`
   - Разрешите приложению отправлять письма
   - На странице появится **Refresh Token**

5. Скопируйте Refresh Token

### Шаг 3: Добавьте в `.env.local`

Отредактируйте файл `.env.local` и замените:

```env
GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN=YOUR_REFRESH_TOKEN
```

На ваши значения (можно скопировать со страницы которая показалась после шага 4)

### Шаг 4: Перезагрузите сервер

```bash
# Остановите текущий сервер (Ctrl+C)
npm run dev
```

## ✅ Готово!

Теперь при бронировании будут отправляться письма на:
- 📧 Email клиента (подтверждение бронирования)
- 📧 habuzovs@gmail.com (уведомление о новом бронировании)

---

## 🔐 Безопасность

- ⚠️ **Никогда** не коммитьте `.env.local` в GitHub
- ⚠️ **Refresh Token** - это как пароль, храните его в безопасности
- ✅ Файл `.env.local` уже в `.gitignore`

---

## 🐛 Если не работает?

**Проблема:** "Precondition check failed"
- Убедитесь, что Refresh Token правильно скопирован (без пробелов в начале/конце)

**Проблема:** "Invalid client"
- Проверьте, что Client ID и Client Secret верны

**Проблема:** "The OAuth client was not found"
- Убедитесь, что создали OAuth2 Client ID (Desktop application), а не Service Account

---

## 📖 Результат

После успешной настройки система будет:
- ✅ Создавать события в Google Calendar
- ✅ Отправлять подтверждение на email клиента
- ✅ Отправлять уведомление вам на habuzovs@gmail.com
- ✅ Генерировать Google Meet ссылки автоматически
