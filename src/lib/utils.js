/**
 * Converte strings numéricas no formato brasileiro (ex: "R$ 1.234,56") para number.
 */
export function parseNumeroBR(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const str = String(val).trim().replace(/[R$\s]/g, '');
  if (!str) return 0;
  // Se contém vírgula decimal (padrão BR), remove separadores de milhar '.' e troca ',' por '.'
  const normalizado = str.includes(',')
    ? str.replace(/\./g, '').replace(',', '.')
    : str;
  const num = parseFloat(normalizado);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Formata um valor numérico como moeda BRL.
 */
export function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Converte data DD/MM/YYYY ou YYYY-MM-DD para ISO YYYY-MM-DD.
 */
export function parseDataBRtoISO(str) {
  if (!str) return null;
  const limpo = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  const partes = limpo.split('/');
  if (partes.length === 3) {
    const [d, m, y] = partes;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Formata uma data ISO YYYY-MM-DD para DD/MM/YYYY.
 */
export function formatDateBR(isoDate) {
  if (!isoDate) return '-';
  const datePart = String(isoDate).split('T')[0];
  return new Date(`${datePart}T00:00:00`).toLocaleDateString('pt-BR');
}

/**
 * Calcula a diferença em dias inteiros entre uma data ISO e a data local de hoje.
 */
export function diffDaysFromToday(isoDate) {
  if (!isoDate) return 0;
  const datePart = String(isoDate).split('T')[0];
  const target = new Date(`${datePart}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
