(async () => {
  try {
    const { default: Jimp } = await import('jimp');
    const path = await import('path');
    const fs = await import('fs');

    const inputPath = path.resolve(__dirname, '..', 'assets', 'images', 'login-bg.jpg');
    const outPath = path.resolve(__dirname, '..', 'assets', 'images', 'login-bg-optimized.jpg');

    if (!fs.existsSync(inputPath)) {
      console.error('Input image not found:', inputPath);
      process.exit(2);
    }

    const image = await Jimp.read(inputPath);
    const MAX_WIDTH = 1600;
    if (image.bitmap.width > MAX_WIDTH) image.resize(MAX_WIDTH, Jimp.AUTO);
    image.quality(75);
    await image.writeAsync(outPath);
    console.log('Optimized image written to', outPath);
  } catch (err) {
    console.error('Image optimization failed:', err);
    process.exit(1);
  }
})();
