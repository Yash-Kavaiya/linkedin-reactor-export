"""Generate a simple icon for the extension."""
import base64, struct, zlib

def create_simple_png(size=48):
    """Create a simple blue LinkedIn-style icon."""
    # Simple blue square with 'Li' text feel
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            # Rounded corners effect
            cx, cy = size//2, size//2
            # Blue background
            r, g, b, a = 10, 102, 194, 255  # LinkedIn blue
            
            # Rounded corners (simple distance check)
            corner_r = size // 5
            in_corner = False
            for cx2, cy2 in [(corner_r, corner_r), (size-corner_r, corner_r), 
                              (corner_r, size-corner_r), (size-corner_r, size-corner_r)]:
                if ((x - cx2)**2 + (y - cy2)**2) > corner_r**2:
                    if x < corner_r or x >= size-corner_r:
                        if y < corner_r or y >= size-corner_r:
                            in_corner = True
            
            if in_corner:
                r, g, b, a = 0, 0, 0, 0
            
            # White 'L' letter in center
            lx, ly = size//4, size//4
            lw = size//8
            lh = size//2
            lb = size//4  # base width
            
            # Vertical bar of L
            if lx <= x <= lx+lw and ly <= y <= ly+lh:
                r, g, b, a = 255, 255, 255, 255
            # Horizontal base of L    
            if lx <= x <= lx+lb and ly+lh-lw <= y <= ly+lh:
                r, g, b, a = 255, 255, 255, 255
                
            row.extend([r, g, b, a])
        pixels.append(row)
    
    # Build PNG
    def make_png(pixels, size):
        def chunk(name, data):
            c = name + data
            return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        
        header = b'\x89PNG\r\n\x1a\n'
        ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit RGBA... wait, type 6 = RGBA
        ihdr_data = struct.pack('>II', size, size) + bytes([8, 6, 0, 0, 0])
        ihdr = chunk(b'IHDR', ihdr_data)
        
        raw = b''
        for row in pixels:
            raw += b'\x00' + bytes(row)
        
        idat = chunk(b'IDAT', zlib.compress(raw))
        iend = chunk(b'IEND', b'')
        
        return header + ihdr + idat + iend
    
    return make_png(pixels, size)

png_data = create_simple_png(48)
with open('icon.png', 'wb') as f:
    f.write(png_data)
print(f"Icon created: {len(png_data)} bytes")
