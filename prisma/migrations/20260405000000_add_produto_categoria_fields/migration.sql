-- AlterTable: add new fields to categorias
ALTER TABLE "categorias"
    ADD COLUMN IF NOT EXISTS "descricao" TEXT,
    ADD COLUMN IF NOT EXISTS "tipo_produto" TEXT,
    ADD COLUMN IF NOT EXISTS "classificacao_bebida" TEXT,
    ADD COLUMN IF NOT EXISTS "icone" TEXT,
    ADD COLUMN IF NOT EXISTS "cor" TEXT,
    ADD COLUMN IF NOT EXISTS "margem_lucro_padrao" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "meta_vendas_mensais" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "comissao_por_venda" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "ordem_exibicao" INTEGER,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ativa',
    ADD COLUMN IF NOT EXISTS "tags" TEXT;

-- AlterTable: add new fields to produtos
ALTER TABLE "produtos"
    ADD COLUMN IF NOT EXISTS "sku" TEXT,
    ADD COLUMN IF NOT EXISTS "codigo_barras" TEXT,
    ADD COLUMN IF NOT EXISTS "preco_custo" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "estoque_minimo" INTEGER,
    ADD COLUMN IF NOT EXISTS "fornecedor" TEXT,
    ADD COLUMN IF NOT EXISTS "validade" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lote" TEXT,
    ADD COLUMN IF NOT EXISTS "localizacao" TEXT,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ativo',
    ADD COLUMN IF NOT EXISTS "descricao" TEXT,
    ADD COLUMN IF NOT EXISTS "tags" TEXT;
