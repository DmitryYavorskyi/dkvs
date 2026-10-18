# Портал ДКВС

Статичний сайт для працівників. Інтерфейс — `index.html`; спільні дані та авторизація працюють через Supabase.

## Публікація

Сайт розгортається у GitHub Pages з гілки `main` через workflow у `.github/workflows/pages.yml`. Після кожного push сайт оновлюється автоматично.

Адреса сайту: <https://dmitryyavorskyi.github.io/dkvs/>

Додайте цю адресу до Supabase → Authentication → URL Configuration як Site URL і до Redirect URLs. Налаштування ролей та активації акаунтів описані в `SUPABASE_SETUP.md`.

У `supabase.js` використовується publishable key, призначений для браузера. Доступ до записів має обмежуватися RLS-політиками з `supabase-schema.sql`; нові акаунти мають залишатися неактивними до перевірки власником.
