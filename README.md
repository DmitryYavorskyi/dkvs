# ДКВС — сайт для GitHub Pages

Статичний сайт відкривається з `index.html`; спільні дані зберігаються в Supabase. Публікацію автоматично запускає GitHub Actions після кожного push у `main`.

## Публікація

1. Створіть репозиторій GitHub і додайте до нього вміст цієї папки.
2. У репозиторії відкрийте **Settings → Pages** і виберіть **GitHub Actions** як джерело публікації.
3. Дочекайтеся завершення workflow **Deploy static site to GitHub Pages** у вкладці **Actions**.
4. У Supabase додайте URL сайту (наприклад, `https://<username>.github.io/<repository>/`) до **Authentication → URL Configuration → Redirect URLs**, а URL сайту задайте як **Site URL**.
5. Виконайте кроки з `SUPABASE_SETUP.md`, якщо схема та перший власник ще не налаштовані.

`supabase.js` містить publishable key для браузера. Нові профілі мають залишатися неактивними, доки власник не перевірить працівника. Застосуйте актуальний `supabase-schema.sql` до відкриття сайту.

