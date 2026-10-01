"""Prepare local artwork for the interactive gallery. No remote code is used."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

catalog = json.loads(Path('assets/sources.json').read_text())
ns = 'http://www.w3.org/2000/svg'
ET.register_namespace('', ns)
scenes = [
 {'id':'tide','name':'Tide','kind':'rings','variation':0,'source':'https://bookofshapes.com/patterns/concentric_noise_rings','art':'./assets/shapes/concentric_noise_rings-art.svg','thumb':'./assets/thumbs/concentric_noise_rings.webp'},
 {'id':'bloom','name':'Bloom','kind':'rings','variation':1,'source':'https://bookofshapes.com/patterns/concentric_noise_rings','art':'./assets/shapes/concentric_noise_rings-art.svg','thumb':'./assets/thumbs/concentric_noise_rings.webp'},
 {'id':'orbit','name':'Orbit','kind':'rings','variation':2,'source':'https://bookofshapes.com/patterns/concentric_noise_rings','art':'./assets/shapes/concentric_noise_rings-art.svg','thumb':'./assets/thumbs/concentric_noise_rings.webp'},
]
for item in catalog:
 path=Path(item['svg'])
 root=ET.parse(path).getroot()
 # An alpha filter keeps the original clipping and occlusion, but removes dark masking fills.
 group=ET.Element('{'+ns+'}g', {'filter':'url(#stillwater-ink)'})
 for child in list(root):
  root.remove(child); group.append(child)
 defs=ET.SubElement(root,'{'+ns+'}defs')
 filt=ET.SubElement(defs,'{'+ns+'}filter', {'id':'stillwater-ink','color-interpolation-filters':'sRGB','x':'-5%','y':'-5%','width':'110%','height':'110%'})
 ET.SubElement(filt,'{'+ns+'}feColorMatrix',{'type':'matrix','values':'0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .416667 .416667 .416667 0 -.125'})
 root.append(group)
 # Explicit dimensions keep the artwork crisp when browsers rasterize the SVG filter.
 box=[float(v) for v in root.attrib['viewBox'].replace(',', ' ').split()]
 scale=1024/max(box[2:])
 root.set('width',str(round(box[2]*scale)));root.set('height',str(round(box[3]*scale)))
 art=path.with_name(path.stem+'-art.svg')
 ET.ElementTree(root).write(art,encoding='unicode')
 if item['id']!='concentric_noise_rings': scenes.append({**{k:item[k] for k in ('id','name','source')},'kind':'svg','art':'./'+str(art),'thumb':'./assets/thumbs/'+item['id']+'.webp'})
Path('assets/catalog.js').write_text('// Artwork: Book of Shapes by Nikolaj Sokolowski. See ARTWORK.md.\nwindow.STILLWATER_SCENES = '+json.dumps(scenes,separators=(',',':'))+';\n')
print(f'{len(scenes)} scenes from {len(catalog)} licensed artworks')
