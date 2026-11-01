// HeroUI switches to dark mode via a `dark` class on <html>. Follow the system setting.
const query = window.matchMedia('(prefers-color-scheme: dark)');
const apply = () => document.documentElement.classList.toggle('dark', query.matches);
apply();
query.addEventListener('change', apply);
