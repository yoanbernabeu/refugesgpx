/**
 * Mini-parseur du markup BBCode-like utilisé par Camptocamp pour les
 * descriptions/accès des waypoints. Sortie : HTML safe pour
 * dangerouslySetInnerHTML.
 *
 * Couvre les balises les plus fréquentes :
 *  - [img=ID position]caption[/img]  → <figure><img><figcaption>
 *  - [url=URL]texte[/url] et [url]URL[/url]
 *  - [b][i][s][u][c]
 *  - [hr]
 *  - # / ## / ### en début de ligne → <h1..6>
 *  - double saut de ligne → <p>, simple saut → <br>
 *
 * Sécurité : on échappe TOUTES les entités HTML d'entrée AVANT de remplacer
 * les balises BBCode, et on valide les URL des liens (http(s) uniquement).
 * Les ID d'images sont contraints à \d+ par la regex.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderC2CMarkup(raw: string | undefined | null): string {
  if (!raw) return '';

  // 1. Normaliser CRLF / CR (Camptocamp renvoie souvent \r\n) puis échapper
  let html = escapeHtml(raw.replace(/\r\n?/g, '\n'));

  // 2. Images : [img=ID position]caption[/img]
  // position est un mot optionnel (left, right, center, inline, …)
  html = html.replace(
    /\[img=(\d+)(?:\s+(\w+))?\]([^\[]*?)\[\/img\]/g,
    (_m, id, pos, caption) => {
      const url = `https://api.camptocamp.org/images/proxy/${id}?size=MI`;
      const cap = (caption ?? '').trim();
      const floatCls =
        pos === 'right' ? ' c2c-figure-right' : pos === 'left' ? ' c2c-figure-left' : '';
      return `<figure class="c2c-figure${floatCls}"><img src="${url}" alt="${cap}" loading="lazy" />${
        cap ? `<figcaption>${cap}</figcaption>` : ''
      }</figure>`;
    },
  );

  // 3. Liens : [url=URL]texte[/url] et [url]URL[/url]
  html = html.replace(/\[url=([^\]]+)\]([^\[]+)\[\/url\]/g, (_m, url, text) => {
    if (!/^https?:\/\//i.test(url)) return text;
    return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
  });
  html = html.replace(/\[url\]([^\[]+)\[\/url\]/g, (_m, url) => {
    if (!/^https?:\/\//i.test(url)) return url;
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
  });

  // 4. Formatage inline
  html = html.replace(/\[b\](.*?)\[\/b\]/gs, '<strong>$1</strong>');
  html = html.replace(/\[i\](.*?)\[\/i\]/gs, '<em>$1</em>');
  html = html.replace(/\[u\](.*?)\[\/u\]/gs, '<u>$1</u>');
  html = html.replace(/\[s\](.*?)\[\/s\]/gs, '<s>$1</s>');
  html = html.replace(/\[c\](.*?)\[\/c\]/gs, '<code>$1</code>');

  // 5. Règle horizontale
  html = html.replace(/\[hr\s*\/?\]/g, '<hr>');

  // 6. Titres style markdown
  html = html.replace(
    /^(#{1,6})\s+(.+)$/gm,
    (_m, h, t) => `<h${h.length}>${t}</h${h.length}>`,
  );

  // 7. Strip toute balise BBCode non gérée restante
  html = html.replace(/\[\/?[\w=#\s]+\]/g, '');

  // 8. Paragraphes : split sur double newline, gardons les blocs déjà
  //    structurés (h*, hr, figure) tels quels
  const paras = html
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paras
    .map((p) => {
      if (/^<(h[1-6]|hr|figure|p|ul|ol)/i.test(p)) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}
