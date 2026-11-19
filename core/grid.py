import sys
from PIL import Image
out,prefix,*ts=sys.argv[1:]
cols=3; rows=(len(ts)+cols-1)//cols; S=Image.new('RGB',(640*cols,360*rows))
for i,t in enumerate(ts): S.paste(Image.open(f'{prefix}_{t}.jpg'),((i%cols)*640,(i//cols)*360))
S.save(out,quality=82)
