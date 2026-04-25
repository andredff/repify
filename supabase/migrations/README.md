# Migrations

Execute estes arquivos SQL no painel do Supabase em **SQL Editor → New Query**, na ordem numérica:

1. `0001_create_posts.sql` — cria as tabelas `posts` e `post_likes`, RLS e triggers de contagem.

Após executar, o backend `/api/posts` está pronto para uso.
