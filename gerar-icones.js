const sharp = require('sharp');

async function gerar() {
    // Icone 512x512 com fundo escuro e logo centralizado
    const bg512 = Buffer.from(
        '<svg width="512" height="512"><rect width="512" height="512" rx="80" fill="#1A1A1A"/></svg>'
    );
    const logo400 = await sharp('logo.png')
        .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();
    await sharp(bg512)
        .composite([{ input: logo400, gravity: 'centre' }])
        .png()
        .toFile('icon-512.png');

    // Icone 192x192
    await sharp('icon-512.png').resize(192, 192).png().toFile('icon-192.png');

    // Icone maskable 512 (mais padding para safe zone do Android)
    const bgMask = Buffer.from(
        '<svg width="512" height="512"><rect width="512" height="512" fill="#1A1A1A"/></svg>'
    );
    const logo320 = await sharp('logo.png')
        .resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();
    await sharp(bgMask)
        .composite([{ input: logo320, gravity: 'centre' }])
        .png()
        .toFile('icon-maskable-512.png');

    // Icone maskable 192
    await sharp('icon-maskable-512.png').resize(192, 192).png().toFile('icon-maskable-192.png');

    console.log('Icones gerados com sucesso!');
}

gerar().catch(e => console.error(e));
