import { formatSql, minifySql } from './index.js';

const byId = (id) => document.getElementById(id);
const sample = `with paid as (
  select user_id, sum(total) as amount
  from orders
  where status = 'paid -- keep literal'
  group by user_id
)
select u.id, u.name, paid.amount
from users u
left join paid on paid.user_id = u.id
where paid.amount >= 100 or paid.amount is null
order by paid.amount desc;`;

function run(action) {
  byId('error').textContent = '';
  try { byId('output').value = action(); }
  catch (error) { byId('error').textContent = error.message; }
}

byId('format').addEventListener('click', () => run(() => formatSql(byId('input').value, {
  keywordCase: byId('keyword-case').value,
  indent: Number(byId('indent').value),
})));
byId('minify').addEventListener('click', () => run(() => minifySql(byId('input').value, { removeComments: byId('remove-comments').checked })));
byId('swap').addEventListener('click', () => { byId('input').value = byId('output').value; byId('format').click(); });
byId('sample').addEventListener('click', () => { byId('input').value = sample; byId('format').click(); });
byId('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(byId('output').value); byId('copy').textContent = '已复制'; setTimeout(() => { byId('copy').textContent = '复制'; }, 1200); }
  catch { byId('error').textContent = 'Clipboard access was denied by the browser.'; }
});
byId('sample').click();
