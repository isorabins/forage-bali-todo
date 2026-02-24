import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uojnuqpfurwgngjqkbjg.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvam51cXBmdXJ3Z25nanFrYmpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzgxMzcsImV4cCI6MjA4NjcxNDEzN30.H2ZxY110AVSbwxEc1op3IUjP-h8G0IldptPmAqpyBVk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
