# 🚀 Deploy no Render - TreinoGo Backend

## Configuração no Render

### 1. **Build Command:**
```bash
./render-deploy.sh
```

### 2. **Start Command:**
```bash
npm start
```

### 3. **Variáveis de Ambiente Necessárias:**

No painel do Render, configure as seguintes variáveis:

```env
# Database
DATABASE_URL=your-neon-db-connection-string

# JWT Secret (gere uma chave segura)
JWT_SECRET=your-super-secure-jwt-secret-key

# Environment
NODE_ENV=production
```

### 4. **Como obter a DATABASE_URL do Neon:**

1. Acesse seu painel do Neon DB
2. Vá em "Connection Details"
3. Copie a "Connection String"
4. Deve estar no formato:
   ```
   postgresql://username:password@host/database?sslmode=require
   ```

### 5. **Deploy Manual (se necessário):**

Se as tabelas ainda não foram criadas, execute no Shell do Render:

```bash
# Opção 1: Push do schema (recomendado para primeira vez)
npx prisma db push --accept-data-loss

# Opção 2: Executar migrações
npx prisma migrate deploy

# Opção 3: Verificar status
npx prisma migrate status

# Opção 4: Debug
./debug-migrations.sh
```

### 6. **Comandos de Emergência:**

```bash
# Se nada funcionar, force a criação das tabelas:
npx prisma db push --force-reset --accept-data-loss

# Verificar se as tabelas foram criadas:
npx prisma db seed # (se você tiver um arquivo de seed)
```

### 6. **Verificação:**

Após o deploy, teste os endpoints:
- `GET /api/health` - Health check
- `POST /api/auth/login` - Teste de autenticação

## 🔧 Troubleshooting

### Problema: "Environment variable not found: DATABASE_URL"
- Verifique se a variável DATABASE_URL está configurada no Render
- Certifique-se que a string de conexão está correta

### Problema: "Table doesn't exist"
- Execute manualmente: `npx prisma migrate deploy`
- Ou use: `npx prisma db push` (para desenvolvimento)

### Problema: Build falha
- Verifique os logs de build no Render
- Certifique-se que todas as dependências estão no package.json