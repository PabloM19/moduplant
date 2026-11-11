"""Prepare the demo from a staged copy of the public Green Digital directory."""
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from PIL import Image

source = Path(sys.argv[1])
project = Path(__file__).resolve().parents[1]
snapshot = project / 'directory'
assets = project / 'public/directory'
directory_prefix = '/plataforma/directorio'
pictures = assets / 'photos'
for folder in [snapshot, snapshot / 'details', assets / 'fonts', pictures]:
    folder.mkdir(parents=True, exist_ok=True)

def soup(path):
    return BeautifulSoup(path.read_text(), 'html.parser')

def local_url(value):
    url = urlsplit(value)
    if url.netloc not in ('greendigital.es', 'www.greendigital.es'):
        return value
    path = url.path.rstrip('/')
    if path.startswith(directory_prefix + '/'):
        path = path[len(directory_prefix):]
        if path.startswith('/imagenes/'):
            size = '-thumb' if 'size=thumb' in url.query else ''
            return '/directory/photos/' + path.split('/')[-1] + size + '.webp'
        if path.startswith(('/plantas/', '/sugerencias', '/favoritos')):
            return path + ('?' + url.query if url.query else '') + ('#' + url.fragment if url.fragment else '')
        if path.startswith('/api/tema/estilos/'):
            return '/directory/theme.css'
        return '/directory' + path
    if path == directory_prefix:
        return '/' + ('?' + url.query if url.query else '') + ('#' + url.fragment if url.fragment else '')
    if '/wp-content/uploads/' in path and path.endswith('.png'):
        name = path.rsplit('/', 1)[-1]
        if not (assets / name).exists():
            subprocess.run(['curl', '-fsSL', '--max-time', '25', value, '-o', str(assets / name)], check=True)
        return '/directory/' + name
    return value

def localize(doc):
    for element in doc.select('[data-favorites-config]'):
        element['data-csrf'] = ''
    for element in doc.select('script, link[rel="canonical"]'):
        src = element.get('src', '')
        if not src or 'content-copy.js' in src:
            element.decompose()
    for element in doc.find_all(True):
        for attr in ['href', 'src', 'action', 'data-gallery', 'data-directory-url', 'data-suggestions-url', 'data-endpoint']:
            value = element.get(attr)
            if not value:
                continue
            if value.startswith('data:image/png;base64,'):
                image = base64.b64decode(value.split(',', 1)[1])
                name = 'brand-' + hashlib.sha256(image).hexdigest()[:12] + '.png'
                (assets / name).write_bytes(image)
                element[attr] = '/directory/' + name
            else:
                element[attr] = local_url(value)
    return doc

for path in (source / 'assets').iterdir():
    if path.suffix == '.ttf':
        shutil.copyfile(path, assets / 'fonts' / path.name)
    elif re.fullmatch(r'[0-9a-f]{64}\.css', path.name):
        style = path.read_text()
        style = re.sub(r'https://greendigital\.es/[^"\']*/fonts/([^/"\']+\.ttf)', r'/directory/fonts/\1', style)
        (assets / 'theme.css').write_text(style)
    else:
        shutil.copyfile(path, assets / path.name)

catalog = localize(soup(source / 'catalog.html'))
empty = localize(soup(source / 'empty.html'))
saved_empty = localize(soup(source / 'saved.html'))
saved = localize(soup(source / 'saved-one.html'))
for name, selector, page in [
    ('opening', '.directory-opening', catalog),
    ('empty', '[data-empty-results]', empty),
    ('saved-empty', '[data-empty-results]', saved_empty),
    ('saved', 'main', saved),
]:
    (snapshot / f'{name}.html').write_text(str(page.select_one(selector)))

cards = {}
for path in sorted((source / 'list').glob('compact-*.html')):
    doc = localize(soup(path))
    for card in doc.select('[data-plant-card]'):
        cards[card['data-plant-card']] = str(card)

catalog.main.clear()
catalog.body.insert(0, catalog.new_tag('div', id='moduplant-toolbar'))
catalog.head.append(catalog.new_tag('link', rel='stylesheet', href='/demo/editor.css'))
catalog.head.append(catalog.new_tag('script', type='module', src='/demo/editor.js'))
(snapshot / 'shell.html').write_text(str(catalog))
catalogue = localize(soup(source / 'catalog.html')).select_one('.live-catalogue')
catalogue.select_one('.catalogue-grid').clear()
(snapshot / 'catalogue.html').write_text(str(catalogue))

care_fields = {
    'luz': ('light', 'Luz'),
    'riego': ('watering', 'Riego'),
    'cuidados': ('location', 'Ubicación'),
    'ambiente': ('climate', 'Temperatura y humedad'),
    'sustrato': ('soil', 'Sustrato y abonado'),
    'poda': ('pruning', 'Poda'),
    'multiplicacion': ('propagation', 'Multiplicación'),
}

items = json.loads((source / 'plants.json').read_text())
assert len(cards) == len(items), (len(cards), len(items))
metadata = []
for item in items:
    slug = item['slug']
    detail = localize(soup(source / 'details' / f'{slug}.html')).main
    fields = {'name': 'Nombre común', 'scientific': 'Nombre científico', 'introduction': 'Introducción'}
    for selector, key in [
        ('.live-detail-heading h1, .live-breadcrumb div > span', 'name'),
        ('.live-scientific', 'scientific'),
        ('.live-introduction', 'introduction'),
        ('.species-description .disclosure-content > p:not(.field-references)', 'description'),
        ('.care-detail .care-text', 'maintenance'),
    ]:
        nodes = detail.select(selector)
        for node in nodes:
            node['data-edit-field'] = key
        if nodes and key in ('description', 'maintenance'):
            fields[key] = {'description': 'Más sobre esta especie', 'maintenance': 'Entorno y mantenimiento'}[key]
    for tooltip in detail.select('.exposure-tooltip[id]'):
        field = care_fields.get(tooltip['id'].rsplit('-', 1)[-1])
        advice = tooltip.select_one('p:not(.attribute-note):not(.field-references)')
        if field and advice:
            key, label = field
            fields[key] = label
            advice['data-edit-field'] = key
    safety = detail.select_one('.safety-note > p:not(.field-references)')
    if safety:
        safety['data-edit-field'] = 'safety'
        fields['safety'] = 'Advertencia completa'
        summary = detail.select_one('.safety-summary > span:not(.text-link)')
        if summary:
            summary['data-edit-summary'] = 'safety'
    for i, row in enumerate(detail.select('.live-traits dl > div'), 1):
        term, value = row.find('dt'), row.find('dd')
        if term and value:
            field = f'trait-{i}'
            value['data-edit-field'] = field
            fields[field] = term.get_text(' ', strip=True)
    for i, line in enumerate(detail.select('.live-problems li, .live-extras > p:not(.eyebrow):not(.field-references)'), 1):
        field = f'problem-{i}'
        line['data-edit-field'] = field
        title = line.parent.parent.find('h3') if line.name == 'li' else None
        fields[field] = f'{title.get_text(" ", strip=True) if title else "Nota sobre problemas"} · {i}'
    for i, faq in enumerate(detail.select('.plant-faq')):
        for selector, key, label in [('summary h3', 'question', 'Pregunta'), ('.plant-faq-answer > p', 'answer', 'Respuesta')]:
            node = faq.select_one(selector)
            if node:
                field = f'faq-{i+1}-{key}'
                node['data-edit-field'] = field
                fields[field] = f'{label} {i+1}'
    metadata.append({
        **{key: item[key] for key in ('id', 'slug', 'common_name', 'scientific_name', 'family', 'category', 'exposure', 'synonyms')},
        'fields': fields,
        'photos': [x['id'] for x in item['images']],
        'card': cards[item['id']],
    })
    for image in detail.select('img[src^="/directory/iconos/"]'):
        path = Path(image['src'].removeprefix('/directory/'))
        target = assets / path
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(project.parents[1] / 'plant-library/public' / path, target)
    (snapshot / 'details' / f'{slug}.html').write_text(detail.decode_contents())
    for photo in item['images']:
        image_id = photo['id']
        preview = pictures / f'{image_id}.webp'
        thumb = pictures / f'{image_id}-thumb.webp'
        if not preview.exists():
            shutil.copyfile(source / 'images' / preview.name, preview)
        if not thumb.exists():
            with Image.open(preview) as image:
                image.thumbnail((600, 600))
                image.save(thumb, 'WEBP', quality=83)

(snapshot / 'plants.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')))
print(f'{len(items)} fichas, {len(cards)} tarjetas, {sum(len(p["photos"]) for p in metadata)} fotos.')
