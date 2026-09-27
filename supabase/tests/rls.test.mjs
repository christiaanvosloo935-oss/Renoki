// Security/behaviour tests for the Renoki schema, run against PGlite
// (real Postgres compiled to WASM) with a minimal Supabase stub.
//   node rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, '..', 'migrations');

process.on("unhandledRejection", (e) => { console.error("FATAL:", e.message, e.where || ""); process.exit(2); });
const db = new PGlite({ extensions: { pg_trgm } });
await db.exec(readFileSync(join(here, 'supabase_stub.sql'), 'utf8'));
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migDir, f), 'utf8'));
}

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? '  ✓' : '  ✗'} ${name}`); };

// Run SQL as a given user (uuid), 'anon', or null (superuser / service role).
async function as(who, sql, params = []) {
  await db.exec('reset role');
  if (who === 'anon') {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  } else if (who) {
    await db.exec(`select set_config('request.jwt.claim.sub', '${who}', false); set role authenticated;`);
  } else {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
  }
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function denied(who, sql, params = []) {
  try { const r = await as(who, sql, params); return r.affectedRows === 0 ? 'no-rows' : false; }
  catch (e) { return e.message; }
}

console.log('\n— sign-up / profiles');
await as(null, `insert into auth.users (id, email, raw_user_meta_data) values
  ($1, 'a@x.com', '{"username":"Alice_1","display_name":"Alice"}'),
  ($2, 'b@x.com', '{"username":"alice_1"}'),
  ($3, 'c@x.com', '{"username":"bad name!"}')`, [A, B, C]);
const profs = (await as('anon', 'select id, username, display_name from profiles order by id')).rows;
ok(profs.length === 3, 'profile auto-created for each sign-up');
ok(profs[0].username === 'alice_1' && profs[0].display_name === 'Alice', 'username lower-cased, display name kept');
ok(profs[1].username.startsWith('user_'), 'taken username falls back to generated one');
ok(profs[2].username.startsWith('user_'), 'invalid username falls back to generated one');
ok(!!await denied(B, `update profiles set bio = 'hacked' where id = $1`, [A]), "B cannot edit A's profile");
ok(!!await denied(A, `update profiles set id = $1 where id = $2`, [C, A]), 'cannot change profile id');
await as(A, `update profiles set bio = 'Curious.' where id = $1`, [A]);
ok((await as(null, 'select bio from profiles where id=$1', [A])).rows[0].bio === 'Curious.', 'A can edit own profile');
ok(!!await denied(A, `update profiles set avatar_path = $1 where id = $2`, [`${B}/x.webp`, A]), "avatar path must be in own folder");

console.log('\n— entries: ownership');
const e1 = (await as(A, `insert into entries (title, excerpt, body, category_id)
  values ('Why flamingos are pink', 'Carotenoids!', 'Flamingos get their colour from carotenoid pigments in their food.',
          (select id from categories where slug='animals')) returning id, author_id`)).rows[0];
ok(e1.author_id === A, 'author_id defaults to the signed-in user');
ok(!!await denied(B, `insert into entries (title, author_id) values ('Spoof', $1)`, [A]), 'cannot create an entry as someone else');
ok(!!await denied('anon', `insert into entries (title) values ('anon post')`), 'anonymous users cannot create entries');
ok((await as('anon', 'select id from entries')).rows.length === 1, 'published entries are publicly readable');
ok(await denied(B, `update entries set title = 'pwned' where id = $1`, [e1.id]) === 'no-rows', "B cannot edit A's entry");
ok(await denied(B, `delete from entries where id = $1`, [e1.id]) === 'no-rows', "B cannot delete A's entry");
ok(!!await denied(A, `update entries set author_id = $1 where id = $2`, [B, e1.id]), 'author cannot transfer ownership');
ok(!!await denied(A, `update entries set like_count = 9999 where id = $1`, [e1.id]), 'cannot fake like counts');
ok(!!await denied(A, `update entries set status = 'published' where id = $1`, [e1.id]), 'cannot change moderation status');
ok(!!await denied(A, `insert into entries (title, like_count) values ('x', 50)`), 'cannot insert with fake counters');
ok(!!await denied(A, `insert into entries (title, source_url) values ('Bad link', 'javascript:alert(1)')`), 'javascript: source URLs rejected');
const before = (await as(null, 'select updated_at from entries where id=$1', [e1.id])).rows[0].updated_at;
await as(A, `update entries set title = 'Why are flamingos pink?' where id = $1`, [e1.id]);
const after = (await as(null, 'select title, updated_at from entries where id=$1', [e1.id])).rows[0];
ok(after.title === 'Why are flamingos pink?' && after.updated_at >= before, 'author can edit own entry');

console.log('\n— images');
const imgSql = `insert into entry_images (entry_id, path, thumb_path, alt_text, position) values ($1, $2, $3, 'A flamingo', $4)`;
ok(!!await denied(B, imgSql, [e1.id, `${B}/${e1.id}/1.webp`, `${B}/${e1.id}/1_t.webp`, 0]), "B cannot add images to A's entry");
ok(!!await denied(A, imgSql, [e1.id, `${B}/${e1.id}/1.webp`, `${B}/${e1.id}/1_t.webp`, 0]), "image path must be in owner's folder");
for (let i = 0; i < 6; i++) await as(A, imgSql, [e1.id, `${A}/${e1.id}/${i}.webp`, `${A}/${e1.id}/${i}_t.webp`, i]);
ok((await as('anon', 'select count(*)::int n from entry_images')).rows[0].n === 6, 'owner can add images; public can see them');
ok(!!await denied(A, imgSql, [e1.id, `${A}/${e1.id}/7.webp`, `${A}/${e1.id}/7_t.webp`, 5]), 'max 6 images per entry');
ok(await denied(B, `delete from entry_images where entry_id = $1`, [e1.id]) === 'no-rows', "B cannot delete A's images");
ok(!!await denied(A, `update entry_images set path = 'x' where entry_id = $1`, [e1.id]), 'image path is immutable');

console.log('\n— storage');
await as(null, `select 1`);
const up = `insert into storage.objects (bucket_id, name) values ($1, $2)`;
ok(!await denied(A, up, ['entry-images', `${A}/${e1.id}/0.webp`]), 'A can upload into own folder');
ok(!!await denied(B, up, ['entry-images', `${A}/${e1.id}/evil.webp`]), "B cannot upload into A's folder");
ok(!!await denied(B, up, ['entry-images', `evil.webp`]), 'cannot upload to bucket root');
ok(await denied(B, `delete from storage.objects where name like $1`, [`${A}/%`]) === 'no-rows', "B cannot delete A's files");
ok((await as('anon', 'select count(*)::int n from storage.objects')).rows[0].n === 0, 'anon cannot list bucket contents');

console.log('\n— tags');
ok(!!await denied(B, `select set_entry_tags($1, array['spam'])`, [e1.id]), "B cannot tag A's entry");
await as(A, `select set_entry_tags($1, array['Flamingos', ' Bird biology ', 'nature', 'nature', '<script>'])`, [e1.id]);
const tags = (await as('anon', `select t.name from entry_tags et join tags t on t.id=et.tag_id where et.entry_id=$1 order by 1`, [e1.id])).rows.map((r) => r.name);
ok(JSON.stringify(tags) === JSON.stringify(['bird-biology', 'flamingos', 'nature', 'script']), `tags normalised & deduped (${tags})`);
ok(!!await denied(A, `select set_entry_tags($1, array['a1','a2','a3','a4','a5','a6','a7','a8','a9'])`, [e1.id]), 'max 8 tags');

console.log('\n— likes / saves / comments');
await as(B, `insert into likes (entry_id) values ($1)`, [e1.id]);
ok(!!await denied(B, `insert into likes (entry_id) values ($1)`, [e1.id]), 'cannot like twice');
ok(!!await denied(B, `insert into likes (user_id, entry_id) values ($1, $2)`, [A, e1.id]), 'cannot like on behalf of someone else');
await as(B, `insert into saved_entries (entry_id) values ($1)`, [e1.id]);
const c1 = (await as(B, `insert into comments (entry_id, body) values ($1, 'Fascinating!') returning id`, [e1.id])).rows[0];
let counts = (await as(null, 'select like_count, save_count, comment_count, updated_at from entries where id=$1', [e1.id])).rows[0];
ok(counts.like_count === 1 && counts.save_count === 1 && counts.comment_count === 1, 'counters maintained by triggers');
ok(+counts.updated_at === +after.updated_at, 'likes/comments do not mark entry as edited');
ok((await as(A, 'select * from saved_entries')).rows.length === 0, "saves are private (A can't see B's)");
ok((await as(B, 'select * from saved_entries')).rows.length === 1, 'user sees own saves');
ok(await denied(A, `delete from comments where id = $1`, [c1.id]) === 'no-rows', "A cannot delete B's comment");
ok(await denied(A, `update comments set body='edited' where id = $1`, [c1.id]) === 'no-rows', "A cannot edit B's comment");
ok(!!await denied(B, `update comments set status='hidden' where id = $1`, [c1.id]), 'cannot change comment status');
await as(B, `delete from comments where id = $1`, [c1.id]);
await as(B, `delete from likes where entry_id = $1`, [e1.id]);
counts = (await as(null, 'select like_count, comment_count from entries where id=$1', [e1.id])).rows[0];
ok(counts.like_count === 0 && counts.comment_count === 0, 'counters decrement on unlike / delete');

console.log('\n— moderation hooks');
const r1 = await as(B, `insert into reports (entry_id, reason, details) values ($1, 'inaccurate', 'Source?') returning id`, [e1.id]);
ok(r1.rows.length === 1, 'users can report an entry');
ok(!!await denied(B, `insert into reports (entry_id, reason) values ($1, 'spam')`, [e1.id]), 'cannot report the same entry twice');
ok((await as(A, 'select * from reports')).rows.length === 0, "reports are private to the reporter");
ok(!!await denied(B, `insert into reports (reason) values ('spam')`), 'report must target an entry or comment');
await as(null, `update entries set status='hidden' where id=$1`, [e1.id]);
ok((await as('anon', 'select id from entries')).rows.length === 0, 'hidden entry invisible to public');
ok((await as('anon', 'select id from entry_images')).rows.length === 0, "hidden entry's images invisible too");
ok((await as(A, 'select id from entries')).rows.length === 1, 'author still sees hidden entry');
ok(!!await denied(C, `insert into likes (entry_id) values ($1)`, [e1.id]), 'cannot like a hidden entry');
await as(null, `update entries set status='published' where id=$1`, [e1.id]);

console.log('\n— search');
const s1 = (await as('anon', `select title from search_entries('carotenoid')`)).rows;
ok(s1.length === 1, 'full-text search matches body');
ok((await as('anon', `select title from search_entries('flamingoes')`)).rows.length === 1, 'fuzzy title match');
ok((await as('anon', `select title from search_entries('bird-biology')`)).rows.length === 1, 'tag match');
ok((await as('anon', `select title from search_entries('x')`)).rows.length === 0, 'too-short query returns nothing');

console.log('\n— deletion cascade');
await as(A, `delete from entries where id=$1`, [e1.id]);
const left = (await as(null, `select (select count(*) from entry_images)::int i, (select count(*) from entry_tags)::int t,
  (select count(*) from saved_entries)::int s, (select count(*) from reports)::int r`)).rows[0];
ok(left.i + left.t + left.s + left.r === 0, 'deleting an entry removes its images rows, tags, saves, reports');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
