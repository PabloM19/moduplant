export const blockTypes = {
  text: 'Campo de texto',
  heading: 'Título',
  section: 'Sección',
  highlight: 'Módulo destacado',
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

export function blockMarkup(blocks) {
  return blocks.filter(block => block.title.trim() || (block.type !== 'heading' && block.text.trim())).map(block => {
    const title = escapeHtml(block.title);
    const content = escapeHtml(block.text);
    if (block.type === 'heading') return `<h2 class="demo-custom-heading">${title}</h2>`;
    if (block.type === 'text') return `<dl class="demo-custom-field">${title ? `<dt>${title}</dt>` : ''}<dd>${content}</dd></dl>`;
    const heading = title ? `<h2>${title}</h2>` : '';
    const body = content ? `<p>${content}</p>` : '';
    return `<section class="demo-custom-block demo-custom-block--${block.type}">${heading}${body}</section>`;
  }).join('');
}

export function shortSafety(value) {
  return value.length > 165 ? value.slice(0, 162).trimEnd() + '…' : value;
}
