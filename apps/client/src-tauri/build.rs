fn main() {
    tauri_build::build();

    // Tauri embeds Common Controls v6 in the app, but not integration test binaries.
    // Without it, the Windows lifecycle check fails before main (tauri#13419).
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/windows.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest.display()
        );
    }
}
