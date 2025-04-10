use image::{ImageBuffer, ImageEncoder, Rgba};
use sha2::{Digest, Sha256};
use std::{
    ffi::c_void,
    fs::File,
    path::{Path, PathBuf},
};
use windows::{
    core::{Interface, PCWSTR},
    Win32::{
        Foundation::SIZE,
        Graphics::Gdi::{
            CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, SelectObject,
            BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP,
        },
        UI::Shell::{
            IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
        },
    },
};

pub fn generate_thumbnail(path: PathBuf) -> Result<String, windows::core::Error> {
    unsafe {
        let wide: Vec<u16> = path
            .to_str()
            .unwrap()
            .to_string()
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let item = SHCreateItemFromParsingName::<_, _, IShellItem>(PCWSTR(wide.as_ptr()), None)?;

        let factory: IShellItemImageFactory = item.cast()?;
        let hbitmap = factory.GetImage(SIZE { cx: 256, cy: 256 }, SIIGBF_BIGGERSIZEOK)?;

        // 🔄 HBITMAP → PNG 変換して一時保存
        // let file_name = path
        //     .file_name()
        //     .unwrap_or_default()
        //     .to_string_lossy()
        //     .replace(".", "-");
        let mut hasher = Sha256::new();
        hasher.update(path.to_string_lossy().as_bytes());
        let hash_result = hasher.finalize();
        let file_name: String = format!("{:x}", hash_result);

        let tmp_path = std::env::temp_dir().join(format!("{}.png", file_name));
        save_bitmap_as_png(hbitmap, &tmp_path)?;

        let url = format!(
            "file:///{}",
            tmp_path
                .to_string_lossy()
                .replace(std::path::MAIN_SEPARATOR, "/")
        );

        Ok(url)
    }
}

pub fn save_bitmap_as_png(hbitmap: HBITMAP, path: &Path) -> Result<(), windows::core::Error> {
    unsafe {
        let mut bmp = BITMAP::default();

        // HBITMAP → BITMAP 構造体を取得
        if GetObjectW(
            hbitmap.into(),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut _ as *mut core::ffi::c_void),
        ) == 0
        {
            return Err(windows::core::Error::from_win32());
        }

        let width = bmp.bmWidth as usize;
        let height = bmp.bmHeight.abs() as usize; // 上下逆に格納されてることがあるため

        // DIB（Device Independent Bitmap）設定
        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: bmp.bmWidth,
                biHeight: -bmp.bmHeight, // 上下反転しないよう負数
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        // ピクセルデータ格納用バッファ
        let mut buffer = vec![0u8; width * height * 4];

        let hdc = CreateCompatibleDC(None);
        if hdc.0 == std::ptr::null_mut() {
            return Err(windows::core::Error::from_win32());
        }

        let old_obj = SelectObject(hdc, hbitmap.into());
        if old_obj.0 == std::ptr::null_mut() {
            if DeleteDC(hdc) == false {
                return Err(windows::core::Error::from_win32());
            }
            return Err(windows::core::Error::from_win32());
        }

        let result = GetDIBits(
            hdc,
            hbitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut c_void),
            &mut bi,
            DIB_RGB_COLORS,
        );

        // クリーンアップ
        SelectObject(hdc, old_obj);

        if DeleteObject(hbitmap.into()) == false {
            return Err(windows::core::Error::from_win32());
        }

        if result == 0 {
            return Err(windows::core::Error::from_win32());
        }

        // BGRA → RGBA変換
        let mut rgba_pixels = vec![0u8; width * height * 4];
        for i in 0..(width * height) {
            rgba_pixels[i * 4 + 0] = buffer[i * 4 + 2]; // R
            rgba_pixels[i * 4 + 1] = buffer[i * 4 + 1]; // G
            rgba_pixels[i * 4 + 2] = buffer[i * 4 + 0]; // B
            rgba_pixels[i * 4 + 3] = buffer[i * 4 + 3]; // A
        }

        // ImageBuffer にして保存
        let img: ImageBuffer<Rgba<u8>, _> =
            ImageBuffer::from_raw(width as u32, height as u32, rgba_pixels).ok_or_else(|| {
                windows::core::Error::new(windows::core::HRESULT(0), "ImageBuffer creation failed")
            })?;

        let file = File::create(path)
            .map_err(|e| windows::core::Error::new(windows::core::HRESULT(0), e.to_string()))?;
        image::codecs::png::PngEncoder::new(file)
            .write_image(
                &img,
                width as u32,
                height as u32,
                image::ExtendedColorType::Rgba8,
            )
            .map_err(|e| windows::core::Error::new(windows::core::HRESULT(0), e.to_string()))?;

        Ok(())
    }
}
