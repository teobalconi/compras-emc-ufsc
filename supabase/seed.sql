-- ============================================================================
-- CARGA INICIAL EXTRAÍDA DAS PLANILHAS [Compras EMC] (2025-26)
-- ============================================================================

-- 1. Equipe
insert into equipe (nome, email, etapas, responsavel) values
  ('Téo Balconi', 'teo.balconi@ufsc.br', 'execução / planejamento', 'Téo Balconi'),
  ('Chefia EMC', 'chefia.emc@contato.ufsc.br', 'recebimento', 'Tadeu Butze'),
  ('Compras EMC', 'compras.emc@contato.ufsc.br', null, null),
  ('José Carlos Pereira', 'j.c.carvalho.p@ufsc.br', null, null),
  ('Tadeu Butze', 'tadeu.b@ufsc.br', null, null)
on conflict (email) do nothing;

-- 2. Cronograma Anual
insert into cronograma_anual (etapa_nome, etapa_num, tipo, atividade, responsavel, dias_uteis, data_inicio, data_fim) values
  ('CRONOGRAMA 1ª ETAPA', 1, 'Inserção', 'Inserção das demandas', 'Unidades', 5, '2026-03-25', '2026-03-31'),
  ('CRONOGRAMA 1ª ETAPA', 1, 'Execução', 'Execução das tarefas conforme divisão', 'Unidades', 15, '2026-04-07', '2026-04-29'),
  ('CRONOGRAMA 2ª ETAPA', 2, 'Inserção', 'Inserção das demandas', 'Unidades', 5, null, null),
  ('CRONOGRAMA 2ª ETAPA', 2, 'Execução', 'Execução das tarefas conforme divisão', 'Unidades', 15, null, null),
  ('CRONOGRAMA 3ª ETAPA', 3, 'Inserção', 'Inserção das demandas', 'Unidades', 5, '2026-07-30', '2026-08-05'),
  ('CRONOGRAMA 3ª ETAPA', 3, 'Execução', 'Execução das tarefas conforme divisão', 'Unidades', 15, '2026-08-11', '2026-08-31'),
  ('CRONOGRAMA 4ª ETAPA', 4, 'Inserção', 'Inserção das demandas', 'Unidades', 5, '2026-09-08', '2026-09-14'),
  ('CRONOGRAMA 4ª ETAPA', 4, 'Execução', 'Execução das tarefas conforme divisão', 'Unidades', 15, '2026-09-18', '2026-10-08'),
  ('CRONOGRAMA 5ª ETAPA', 5, 'Inserção', 'Inserção das demandas', 'Unidades', 5, '2026-10-15', '2026-10-21'),
  ('CRONOGRAMA 5ª ETAPA', 5, 'Execução', 'Execução das tarefas conforme divisão', 'Unidades', 15, '2026-10-27', '2026-11-11');

-- 3. Grupos por Etapa (Etapas 1 a 5)
insert into grupos_etapa (etapa, grupo, descricao) values
  -- Etapa 1
  (1, '099.01', 'SUPRIMENTOS DE INFORMÁTICA'),
  (1, '099.11', 'MATERIAIS DE TELEFONIA/INFORMÁTICA'),
  (1, '077.06', 'APARELHOS E EQUIPAMENTOS DE COMUNICAÇÃO'),
  (1, '077.32', 'MÁQUINAS E EQUIPAMENTOS GRÁFICOS'),
  (1, '077.35', 'EQUIPAMENTOS DE TECNOLOGIA DA INFORMAÇÃO E COMUNICAÇÃO - PROCESSAMENTO DE DADOS'),
  (1, '099.23', 'MATERIAL DE CAMA, MESA E BANHO'),
  (1, '099.44', 'MATERIAL DE SINALIZAÇÃO VISUAL E AFINS'),
  (1, '077.04', 'APARELHO DE MEDIÇÃO'),
  (1, '077.08', 'APARELHOS, EQUIPAMENTOS E UTENSÍLIOS MÉDICO-HOSPITALARES, ODONTOLÓGICOS E LABORATORIAIS'),
  (1, '077.12', 'APARELHOS E UTENSÍLIOS DOMÉSTICOS'),
  (1, '077.18', 'COLEÇÕES E MATERIAL BIBLIOGRÁFICO (EXCLUSIVO BIBLIOTECA UNIVERSITÁRIA)'),
  (1, '077.24', 'EQUIPAMENTOS DE PROTEÇÃO, SEGURANÇA E SOCORRO'),
  (1, '077.42', 'MOBILIÁRIO EM GERAL'),
  (1, '099.26', 'FERRAMENTAS (atividades ensino, pesquisa, extensão, laboratoriais etc.)'),
  (1, '099.12', 'GÊNEROS ALIMENTÍCIOS - HORTIFRUTIGRANJEIROS'),
  (1, '201', null),
  -- Etapa 2
  (2, '077.28', 'MÁQUINAS E EQUIPAMENTOS INDUSTRIAIS'),
  (2, '077.30', 'MÁQUINAS E EQUIPAMENTOS ENERGÉTICOS'),
  (2, '077.34', 'MÁQUINAS E EQUIPAMENTOS - UTENSÍLIOS DIVERSOS'),
  (2, '077.39', 'EQUIPAMENTOS E UTENSÍLIOS HIDRÁULICOS E ELÉTRICOS'),
  (2, '077.48', 'VEÍCULOS DIVERSOS'),
  (2, '077.38', 'MÁQUINAS E FERRAMENTAS - UTENSÍLIOS DE OFICINA'),
  (2, '077.20', 'EMBARCAÇÕES - sem demanda'),
  (2, '077.40', 'MÁQUINAS E EQUIPAMENTOS AGRÍCOLAS E RODOVIÁRIOS - sem demanda'),
  (2, '099.16', 'MATERIAL DE PROTEÇÃO E SEGURANÇA - PROTEÇÃO INDIVIDUAL (EPI) / UNIFORMES'),
  (2, '203.12', 'FERRAMENTAS (manutenção - exclusivo PU e Campi)'),
  (2, '099.25', 'MATERIAL E EQUIPAMENTO DE ÁUDIO, VÍDEO E FOTO'),
  (2, '077.33', null),
  (2, '201', null),
  -- Etapa 3
  (3, '51', 'MATERIAL DE LIMPEZA (EXCLUSIVO ALMOXARIFADO CENTRAL)'),
  (3, '099.14', 'MATERIAL DE LIMPEZA'),
  (3, '51', 'MATERIAIS DE EXPEDIENTE (EXCLUSIVO ALMOXARIFADO CENTRAL)'),
  (3, '099.13', 'MATERIAIS DE EXPEDIENTE'),
  (3, '077.36', 'MÁQUINAS E UTENSÍLIOS DE ESCRITÓRIO'),
  (3, '099.02', 'MATERIAL DE LABORATÓRIO - REAGENTES'),
  (3, '203.02', 'CARPINTARIA, PINTURA, SERRALHERIA E VIDRAÇARIA (MANUTENÇÃO - EXCLUSIVO PU E CAMPI)'),
  (3, '203.05', null),
  (3, '203.08', null),
  (3, '203.11', null),
  (3, '201', null),
  -- Etapa 4
  (4, '099.04', 'MATERIAIS DE LABORATÓRIO - UTENSÍLIOS'),
  (4, '203.04', 'MATERIAIS HIDRÁULICOS (manutenção - exclusivo PU e Campi)'),
  (4, '099.08', 'MATERIAIS HIDRÁULICOS'),
  (4, '203.01', 'MATERIAIS DE ALVENARIA (manutenção - exclusivo PU e Campi)'),
  (4, '099.09', 'MATERIAIS DE ALVENARIA'),
  (4, '203.03', 'MATERIAIS ELÉTRICOS (manutenção - exclusivo PU e Campi)'),
  (4, '099.07', 'MATERIAIS ELÉTRICOS'),
  (4, '099.18', 'COPA E COZINHA'),
  (4, '201', null),
  (4, '099.10', 'MATERIAIS DE REFRIGERAÇÃO'),
  (4, '099.12', 'GÊNEROS ALIMENTÍCIOS - CÁRNEOS'),
  (4, '099.19', 'MATERIAIS DE ACONDICIONAMENTO E EMBALAGENS'),
  (4, '099.12', 'GÊNEROS ALIMENTÍCIOS - NÃO PERECÍVEIS'),
  -- Etapa 5
  (5, '099.15', 'MATERIAIS AGROPECUÁRIOS'),
  (5, '099.22', 'MATERIAIS VETERINÁRIOS'),
  (5, '099.05', 'MATERIAIS ODONTOLÓGICOS - RADIOLOGIA'),
  (5, '099.06', null),
  (5, '099.29', 'MEDICAMENTOS HUMANOS'),
  (5, '077.12', 'AR CONDICIONADO E BEBEDOURO'),
  (5, '099.20', 'MATERIAL PEDAGÓGICO E ESPORTIVO'),
  (5, '077.10', 'APARELHOS E EQUIPAMENTOS PARA ESPORTES E DIVERSÃO'),
  (5, '099.03', 'MATERIAIS DE LABORATÓRIO – VIDRARIA'),
  (5, '099.17', 'GASES MEDICINAIS E INDUSTRIAIS');
