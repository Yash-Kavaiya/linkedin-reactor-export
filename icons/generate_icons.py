"""Generate LinkedIn Reactor Exporter Pro icons."""
import struct, zlib, os

def create_png(size):
    pixels = []
    r2 = size // 5  # corner radius

    for y in range(size):
        row = []
        for x in range(size):
            # Default: LinkedIn blue
            pr, pg, pb, pa = 10, 102, 194, 255

            # Rounded corners
            corners = [(r2, r2), (size-1-r2, r2), (r2, size-1-r2), (size-1-r2, size-1-r2)]
            in_corner_zone = (x < r2 or x > size-1-r2) and (y < r2 or y > size-1-r2)
            if in_corner_zone:
                # find nearest corner center
                min_dist2 = min((x-cx)**2 + (y-cy)**2 for cx,cy in corners)
                if min_dist2 > r2*r2:
                    pr, pg, pb, pa = 0, 0, 0, 0
                    row.extend([pr, pg, pb, pa])
                    continue

            # White letter design
            m = max(size // 8, 1)
            # Vertical white bar (left side, like LinkedIn 'in')
            if size//5 <= x <= size//5 + m*2 and size//4 <= y <= size*3//4:
                pr, pg, pb, pa = 255, 255, 255, 255
            # Circle top of 'i' dot
            cx2, cy2 = size//5 + m, size//5
            if (x-cx2)**2 + (y-cy2)**2 <= (m+1)**2:
                pr, pg, pb, pa = 255, 255, 255, 255
            # 'n' right side
            nx = size//2
            if nx <= x <= nx + m*2 and size//4 <= y <= size*3//4:
                pr, pg, pb, pa = 255, 255, 255, 255
            # 'n' arch (top horizontal + right down)
            if nx <= x <= nx + m*5 and size//4 <= y <= size//4 + m*2:
                pr, pg, pb, pa = 255, 255, 255, 255
            if nx + m*3 <= x <= nx + m*5 and size//4 <= y <= size*3//4:
                pr, pg, pb, pa = 255, 255, 255, 255

            # Small export arrow at bottom right corner
            ar = size * 3 // 4
            if ar <= x <= ar + m*3 and size*3//4 <= y <= size*3//4 + m:
                pr, pg, pb, pa = 255, 220, 50, 255  # yellow accent
            if ar + m <= x <= ar + m*2 and size*3//4 - m <= y <= size*3//4 + m*2:
                pr, pg, pb, pa = 255, 220, 50, 255

            row.extend([pr, pg, pb, pa])
        pixels.append(row)

    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>II', size, size) + bytes([8, 6, 0, 0, 0])
    ihdr = chunk(b'IHDR', ihdr_data)

    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes(row)

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend

os.chdir(os.path.dirname(os.path.abspath(__file__)))
for size, name in [(16, 'icon16.png'), (48, 'icon48.png'), (128, 'icon128.png')]:
    with open(name, 'wb') as f:
        f.write(create_png(size))
    print(f"Created {name} ({size}x{size})")
