#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() == 3 && args[1] == "--provider-token-id" {
        let service = codex_helm_lib::provider::ProviderService::new(
            codex_helm_lib::paths::AppPaths::detect(),
        );

        let local_id = match args[2].parse::<i64>() {
            Ok(local_id) => local_id,
            Err(error) => {
                eprintln!("{error}");
                std::process::exit(1);
            }
        };

        match service.token_for_provider_local_id(local_id) {
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
