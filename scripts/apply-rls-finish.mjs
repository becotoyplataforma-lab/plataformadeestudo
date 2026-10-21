import postgres from 'postgres';

const connectionString = 'postgresql://postgres.sqrjovmqupjowyilgbsp:v7Je7hfuG68H0phh@aws-0-ca-central-1.pooler.supabase.com:6543/postgres?sslmode=require';
const sql = postgres(connectionString, { timeout: 10, max: 1 });

async function run() {
  await sql.unsafe(`ALTER TABLE IF EXISTS public.notice_topics ENABLE ROW LEVEL SECURITY;`);
  await sql.unsafe(`DROP POLICY IF EXISTS "notice_topics_select" ON public.notice_topics;`);
  await sql.unsafe(`CREATE POLICY "notice_topics_select" ON public.notice_topics FOR SELECT USING (true);`);

  await sql.unsafe(`DROP POLICY IF EXISTS "documents_own_or_public" ON public.documents;`);
  await sql.unsafe(`CREATE POLICY "documents_own_or_public" ON public.documents FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);`);

  console.log('NOTICE_TOPICS AND DOCUMENTS RLS APPLIED!');

  const rlsStatus = await sql`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  console.log('\n=== ALL TABLES RLS STATUS ===');
  let allSafe = true;
  for (const r of rlsStatus) {
    if (!r.rowsecurity) {
      allSafe = false;
      console.log(`❌ EXPOSED: ${r.tablename}`);
    } else {
      console.log(`✅ SAFE: ${r.tablename}`);
    }
  }
  if (allSafe) {
    console.log('\n🎯 ALL 100% OF PUBLIC TABLES HAVE RLS ENABLED!');
  }
  await sql.end();
}

run().catch(console.error);
