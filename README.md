

## 🏗️ Arquitetura

```
Backend (Node.js + Express)
├── IA Customizada (Fuzzy Search + NLP)
│   ├── fuse.js — busca aproximada de produtos
│   └── @microsoft/recognizers-text-suite — extração de números em português
├── Prisma ORM — acesso ao banco de dados
├── PostgreSQL 15 (via Docker)
└── API REST completa
```

---

## 🚀 Setup Rápido (Windows + Docker)

### Pré-requisitos
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/lucaolokao/cortexai-esp.git
cd cortexai-esp
npm install
```

### 2. Configurar variáveis de ambiente

```bash
# Copiar o arquivo de exemplo
copy .env.example .env
```

O arquivo `.env` já vem configurado para o Docker local:
```env
DATABASE_URL="postgresql://cortexai:cortexai123@localhost:5432/cortexai"
PORT=3000
NODE_ENV=development
```

### 3. Subir o PostgreSQL com Docker

```bash
docker-compose up -d
```

Aguarde o container iniciar (~10 segundos). Verifique com:
```bash
docker ps
```

### 4. Criar o banco de dados e rodar migrations

```bash
npx prisma migrate dev --name init
```

### 5. Popular com dados iniciais

```bash
node prisma/seed.js
```

### 6. Gerar cliente Prisma

```bash
npx prisma generate
```

### 7. Iniciar o servidor e o dashboard (recomendado)

```bash
# Roda backend (porta 3000) + dashboard Next.js (porta 3001) ao mesmo tempo:
npm run dev
```

Ou separadamente:

```bash
# Só o backend:
npm run dev:backend

# Só o dashboard:
npm run dev:dashboard
```

✅ Backend API: **http://localhost:3000**  
✅ Dashboard Next.js: **http://localhost:3001**

---

## 🖥️ Dashboard Next.js

O dashboard foi migrado de HTML puro para **TypeScript + Next.js + Tailwind CSS 4**.

### Estrutura:

```
dashboard/
├── app/
│   ├── layout.tsx          # Layout global com Sidebar
│   ├── page.tsx            # Dashboard principal (stats, IA, vendas)
│   ├── Estoque/page.tsx    # Gestão de estoque (CRUD completo)
│   ├── Categorias/page.tsx # Gestão de categorias (CRUD + bebidas)
│   ├── Vendas/page.tsx     # Histórico de vendas com filtros
│   └── Relatorios/page.tsx # Gráficos e relatórios
├── components/
│   ├── Sidebar.tsx         # Navegação lateral fixa
│   ├── Modal.tsx           # Modal reutilizável
│   ├── Toast.tsx           # Notificações toast
│   └── LoadingSpinner.tsx  # Indicador de carregamento
└── lib/
    ├── api.ts              # Cliente HTTP para o backend
    ├── types.ts            # Interfaces TypeScript
    └── context.tsx         # Contextos React (Toast + Tema)
```

### Recursos do Dashboard:

- 🎨 **Design**: Paleta Indigo/Slate, modo escuro, animações suaves
- 📦 **Estoque**: SKU, código de barras, preço de custo/venda, margem de lucro, validade, fornecedor, localização, tags
- 🏷️ **Categorias**: Tipo (bebida/comida/eletrônico), classificação (alcoólica 18+ / refrigerada), ícone, cor, metas
- 💰 **Vendas**: Histórico completo com filtros, exportar CSV
- 📊 **Relatórios**: Gráficos de faturamento, top produtos, distribuição por categoria
- 🤖 **IA**: Widget para processar texto e confirmar vendas
- 🌙 **Dark mode**: Suporte completo com textos legíveis
- 📱 **Responsivo**: Mobile, tablet e desktop

---

## 🧠 Testar a IA

Abra o arquivo `teste.http` no VS Code (extensão REST Client) ou use curl:

### Exemplo básico:


```bash
curl -X POST http://localhost:3000/api/processar-texto \
  -H "Content-Type: application/json" \
  -d "{\"texto\": \"2 coca cola, 1 agua mineral\"}"
```

**Resposta:**
```json
{
  "sucesso": true,
  "audioLogId": 1,
  "texto": "2 coca cola, 1 agua mineral",
  "itens": [
    {
      "textoOriginal": "2 coca cola",
      "produto": { "nome": "Coca-Cola", "preco": 5.99, "estoque": 50 },
      "quantidade": 2,
      "confianca": 91,
      "encontrado": true
    },
    {
      "textoOriginal": "1 agua mineral",
      "produto": { "nome": "Agua Mineral", "preco": 2.99, "estoque": 100 },
      "quantidade": 1,
      "confianca": 95,
      "encontrado": true
    }
  ],
  "resumo": {
    "totalItens": 2,
    "encontrados": 2,
    "confiancaMedia": 93,
    "totalEstimado": 14.97
  }
}
```

### Outros exemplos de texto:

```
"2 coca cola, 1 agua mineral"
"dois brigadeiros, três batatas lays"
"1 coca, 2 agua, 1 brigadero"        ← fuzzy corrige "brigadero"
"3 guarana e 2 pao de queijo"
```

---

## 📡 Endpoints da API

### IA

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/processar-texto` | Recebe texto, retorna produtos com confiança |
| POST | `/api/audio` | Stub para áudio do ESP32 (em breve) |
| GET | `/api/audio-logs` | Histórico de processamentos da IA |

### Vendas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/venda` | Registra venda (campos: produto, quantidade, preco, origem) |
| GET | `/api/historico` | Histórico de vendas |
| GET | `/api/vendas` | Alias de /api/historico |
| GET | `/api/faturamento-dia` | Faturamento do dia atual |

### Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/produtos` | Lista todos os produtos |
| POST | `/api/produto` | Cria produto |
| PUT | `/api/produto` | Atualiza estoque/preço |
| DELETE | `/api/produto` | Remove produto |

### Categorias

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/categorias` | Lista categorias |
| POST | `/api/categoria` | Cria categoria |
| DELETE | `/api/categoria` | Remove categoria |

### Estatísticas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stats` | Total vendas, faturamento, ticket médio, valor estoque |
| GET | `/api/vendas-7dias` | Vendas agrupadas por dia (últimos 7 dias) |

### ESP32

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/heartbeat` | ESP32 reporta que está online |
| GET | `/api/esp-status` | Verifica se ESP32 está online |

---

## 📦 Stack Tecnológica

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Node.js | 18+ | Runtime |
| Express.js | 5.x | Web framework |
| Prisma ORM | 7.x | ORM + migrations |
| PostgreSQL | 15 | Banco de dados |
| Docker | - | Container PostgreSQL |
| fuse.js | 7.x | Fuzzy search de produtos |
| @microsoft/recognizers-text-suite | 1.x | NLP em português |
| dotenv | 17.x | Variáveis de ambiente |

---

## 🗄️ Schema do Banco de Dados

```prisma
model Categoria {
  id       Int      @id @default(autoincrement())
  nome     String   @unique
  criadoEm DateTime @default(now())
}

model Produto {
  id           Int      @id @default(autoincrement())
  nome         String   @unique
  estoque      Int      @default(0)
  preco        Float
  categoria    String
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt
}

model Venda {
  id         Int      @id @default(autoincrement())
  produto    String
  quantidade Int
  preco      Float
  total      Float
  origem     String   @default("manual")  // manual | ia | esp32
  data       DateTime @default(now())
  audioLogId Int?
  audioLog   AudioLog?
}

model AudioLog {
  id            Int      @id @default(autoincrement())
  textoOriginal String
  resultado     Json?    // Array de itens processados
  confianca     Float?   // Média de confiança (0-100)
  sucesso       Boolean  @default(false)
  criadoEm      DateTime @default(now())
  vendas        Venda[]
}
```

---

## 🔧 Scripts Disponíveis

```bash
npm start              # Inicia o servidor
npm run db:migrate     # Cria/aplica migrations
npm run db:seed        # Popula dados iniciais
npm run db:studio      # Abre Prisma Studio (visualizar BD)
npm run db:generate    # Gera cliente Prisma
npm run setup          # Faz tudo de uma vez (install + migrate + seed)
```

---

## 🐳 Docker

```bash
# Subir PostgreSQL
docker-compose up -d

# Parar
docker-compose down

# Ver logs do PostgreSQL
docker logs cortexai-postgres

# Parar e remover volume (APAGA OS DADOS)
docker-compose down -v
```

---

## 🔌 Integração React (begninibruno/TCC_CortexAI)

O React pode consumir esta API diretamente:

```typescript
// Processar texto via IA
const response = await fetch('http://localhost:3000/api/processar-texto', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ texto: "2 coca cola, 1 agua mineral" })
});
const data = await response.json();
```

---

## 🔮 Próximos Passos (ESP32)

Quando o hardware chegar:
1. Conectar INMP441 (microfone I2S) ao ESP32-S3
2. Capturar áudio no ESP32
3. Enviar para `POST /api/audio`
4. O backend converte áudio → texto → chama `processarTexto()`
5. Retorna produtos identificados pela IA

---

## 📁 Estrutura do Projeto

```
cortexai-esp/
├── docker-compose.yml          # PostgreSQL container
├── .env.example                # Variáveis de exemplo
├── prisma/
│   ├── schema.prisma           # Modelos do banco
│   └── seed.js                 # Dados iniciais
├── src/
│   ├── database/
│   │   └── prisma.js           # Singleton Prisma Client
│   └── modules/
│       └── ia/
│           └── ia.service.js   # Fuzzy Search + NLP
├── public/
│   └── dashboard.html          # Dashboard web
├── server.js                   # Servidor Express (entry point)
├── teste.http                  # Exemplos de chamadas API
└── README.md
```
