# 📊 Controle Financeiro - Guia Power BI

## 📁 Arquivos Criados

### 1. **Fato_Transacoes.csv** (Tabela Principal)
Todas as transações financeiras com:
- Data específica
- Tipo (Receita/Despesa)
- Categoria e Subcategoria
- Valor numérico limpo
- Forma de pagamento
- Status

### 2. **Dim_Categorias.csv** (Dimensão)
Categorização completa com:
- ID único
- Tipo de despesa (Fixa/Variável)
- Classificação de essencialidade

### 3. **Dim_Calendario.csv** (Dimensão Temporal)
Tabela calendário para análises temporais

### 4. **Orcamento_Planejado.csv** (Orçamento)
Comparação planejado vs realizado

### 5. **Simulacoes.csv** (Cenários)
Simulações de novos gastos (como carro próprio)

---

## 🔧 Como Importar no Power BI

### Passo 1: Importar Dados
1. Abra o Power BI Desktop
2. Clique em "Obter Dados" → "Texto/CSV"
3. Importe cada arquivo CSV na seguinte ordem:
   - Fato_Transacoes.csv
   - Dim_Categorias.csv
   - Dim_Calendario.csv
   - Orcamento_Planejado.csv
   - Simulacoes.csv

### Passo 2: Criar Relacionamentos
No menu "Modelo", crie os relacionamentos:

```
Dim_Calendario[Data] → Fato_Transacoes[Data] (1:N)
Dim_Categorias[Categoria] → Fato_Transacoes[Categoria] (1:N)
```

### Passo 3: Criar Medidas DAX

```dax
// Total Receitas
Total Receitas = 
CALCULATE(
    SUM(Fato_Transacoes[Valor]),
    Fato_Transacoes[Tipo] = "Receita"
)

// Total Despesas
Total Despesas = 
CALCULATE(
    SUM(Fato_Transacoes[Valor]),
    Fato_Transacoes[Tipo] = "Despesa"
)

// Saldo do Mês
Saldo = [Total Receitas] - [Total Despesas]

// % Despesas por Categoria
% Categoria = 
DIVIDE(
    SUM(Fato_Transacoes[Valor]),
    CALCULATE(SUM(Fato_Transacoes[Valor]), ALL(Fato_Transacoes[Categoria]))
)

// Despesas Essenciais
Despesas Essenciais = 
CALCULATE(
    [Total Despesas],
    Dim_Categorias[Essencial] = "Sim"
)

// Despesas Não Essenciais
Despesas Não Essenciais = 
CALCULATE(
    [Total Despesas],
    Dim_Categorias[Essencial] = "Não"
)

// Taxa de Economia
Taxa Economia = 
DIVIDE([Saldo], [Total Receitas], 0)

// Média Diária de Gastos
Média Diária = 
DIVIDE(
    [Total Despesas],
    COUNTROWS(DISTINCT(Fato_Transacoes[Data]))
)
```

---

## 📈 Visuais Sugeridos para o Dashboard

### Página 1: Visão Geral
1. **Cartões (KPI):**
   - Total Receitas
   - Total Despesas
   - Saldo Final
   - Taxa de Economia %

2. **Gráfico de Pizza:**
   - Despesas por Categoria

3. **Gráfico de Barras:**
   - Top 10 Maiores Despesas

4. **Gráfico de Linhas:**
   - Evolução de Receitas x Despesas (quando tiver mais meses)

### Página 2: Análise por Categoria
1. **Matriz:**
   - Categoria → Subcategoria → Valor

2. **Gráfico de Barras Empilhadas:**
   - Despesas Essenciais vs Não Essenciais

3. **Tabela:**
   - Detalhamento de transações

### Página 3: Planejamento
1. **Gráfico de Barras Clusterizado:**
   - Planejado vs Realizado por categoria

2. **Cartão de Simulação:**
   - Impacto do carro próprio no orçamento

3. **Gráfico de Cascata:**
   - De Receita até Saldo (mostrando cada dedução)

---

## 🎨 Dicas de Formatação

- **Cores sugeridas:**
  - Receitas: Verde (#28A745)
  - Despesas: Vermelho (#DC3545)
  - Saldo Positivo: Azul (#007BFF)
  - Essencial: Laranja (#FD7E14)

- **Formatação de valores:**
  - Formato: R$ #.##0,00
  - Negativos em vermelho

---

## 📊 Análise dos Dados Atuais

### Resumo Janeiro/2026:
- **Receitas:** R$ 7.877,58
- **Despesas:** R$ 14.009,10
- **Saldo:** -R$ 6.131,52 ⚠️
- **Déficit de:** 77,8%

### Principais Gastos:
1. Viagem: R$ 2.500,00 (17,8%)
2. Combustível Shell: R$ 1.500,00 (10,7%)
3. Compras de Natal: R$ 1.200,00 (8,6%)
4. Aluguel de Carro: R$ 1.200,00 (8,6%)
5. Dízimos: R$ 1.935,45 (13,8%)

### ⚠️ Alertas:
- Gastos excedem receitas em 78%
- Despesas extraordinárias (viagem, natal) comprometeram orçamento
- Simulação de carro próprio (R$ 1.200/mês) é inviável no momento
- Despesas com educação atrasadas indicam dificuldade de fluxo

### ✅ Recomendações:
1. Eliminar despesas não essenciais (viagens, compras extraordinárias)
2. Revisar assinaturas e serviços (3 linhas de celular)
3. Comparar aluguel de carro vs transporte público
4. Criar reserva de emergência antes de novos compromissos
5. Renegociar parcelas atrasadas da Estácio

---

## 🔄 Próximos Passos

1. **Mensalmente:** Adicionar novas linhas no Fato_Transacoes.csv
2. **Atualizar:** No Power BI, clicar em "Atualizar" para carregar novos dados
3. **Acompanhar:** Métricas de evolução mês a mês
4. **Ajustar:** Orçamento planejado baseado em dados reais

---

## 📞 Suporte

Para dúvidas sobre:
- **DAX:** Consultar documentação Microsoft
- **Visuais:** Marketplace do Power BI tem templates prontos
- **Estrutura:** Este guia cobre o básico, personalize conforme necessidade
