Repify é um app de fitness social com foco em:
Consistência de treino
Feed baseado em ações reais (check-in)
Gamificação (XP, desafios, ranking)
Engajamento social (grupos, competição)

Frontend (Angular)
API Gateway (Node.js / NestJS)
Microservices
Database + Cache + Storage

Angular (standalone components)
RxJS
SCSS
PWA ready


### Estrutura:

```
src/
  core/
  shared/
  ui/
  features/
    auth/
    feed/
    training/
    groups/
    profile/
    challenge/
```

### Responsabilidades:

- Renderização de UI
- Estado local
- Consumo de APIs
- Controle de permissões (auth / preview)

### Boas práticas:

- ChangeDetectionStrategy.OnPush
- Lazy loading por feature
- Async pipe
- Skeleton loading

---

## API Gateway

### Stack:

- Node.js (NestJS)
- JWT
- Rate limit

### Responsabilidades:

- Autenticação
- Roteamento
- Validação inicial
- Agregação de dados

---

## Microservices

### Auth Service

- Login / Registro
- JWT / Refresh Token
- Preview mode

---

### Training Service

- Criar treino
- Concluir treino
- Regra: 1 treino válido por dia
- Cálculo de XP

---

### Feed Service

- Criar posts (após treino)
- Feed paginado
- (Futuro: likes, comentários)

---

### Media Service

- Upload de imagem
- Compressão (Sharp)
- Resize (thumb / medium / full)
- Storage (S3)

---

### Challenge Service

- Desafios semanais
- Reset automático
- Progresso do usuário

---

### Group Service

- Criar grupo
- Adicionar membros
- Ranking interno

---

### Gamification Service

- XP
- Level
- Streak
- Badges

---

### otification Service

- Push notifications
- Eventos do sistema

---

##  Banco de Dados

### Principal:

- PostgreSQL

### Tabelas:

- users
- trainings
- posts
- groups
- group_members
- challenges
- user_progress
- notifications

---

## ⚡ Cache

- Redis

### Uso:

- Feed
- Ranking
- Sessão
- Rate limit

---

## 📦 Storage

- S3 (ou equivalente)

### Estrutura:

```
/posts/{userId}/{postId}.webp
/posts/{userId}/{postId}_thumb.webp
```

---

## 🔁 Arquitetura por Eventos

Fila: BullMQ / Kafka

### Fluxo:

```
Treino concluído →
  Atualiza XP →
  Atualiza desafio →
  Atualiza ranking →
  Libera post
```

---

## 🔒 Regras de Negócio

- Só pode postar após treino concluído
- 1 treino válido por dia
- Preview não pode interagir
- Post pode ser livre após treino do dia

---

## 🚀 Performance

- CDN para imagens
- Lazy loading
- Paginação (cursor-based)
- Compressão de imagens
- Cache no feed

---

## 📱 UX

- Feedback imediato (XP, progresso)
- Sensação de evolução
- Gamificação visível
- UI rápida

---

## 🧪 Observabilidade

- Logs estruturados
- Monitoramento (Datadog ou similar)
- Alertas

---

## 🔐 Segurança

- JWT + refresh token
- Validação no backend
- Rate limit
- Sanitização de upload

---

## 📈 Escalabilidade

- Serviços independentes
- Horizontal scaling
- CDN global
- Feature flags

---

## 🧠 Loop de Produto

```
Treino → Recompensa → Prova social → Competição → Repetição
```

---
