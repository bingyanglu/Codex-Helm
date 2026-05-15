#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() == 3 && args[1] == "--provider-token" {
        let service = codex_helm_lib::provider::ProviderService::new(
            codex_helm_lib::paths::AppPaths::detect(),
        );

        match service.token_for_provider(&args[2]) {
            Ok(token) => {
                println!("{token}");
                return;
            }
            Err(error) => {
                eprintln!("{error}");
                std::process::exit(1);
            }
        }
    }

    codex_helm_lib::run();
}
