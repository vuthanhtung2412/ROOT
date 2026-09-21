# Root repo utilities
.PHONY: clean clean-logs clean-tmp remote

# Build Phaser → serve via @root/web → Tailscale Funnel → print stable URL
remote:
	@bash scripts/remote-play.sh

clean: clean-logs clean-tmp

# Wipe logs/ contents (keep directory).
clean-logs:
	@mkdir -p logs
	@find logs -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
	@echo 'cleared logs/'

# Wipe tmp/ contents (keep directory).
clean-tmp:
	@mkdir -p tmp
	@find tmp -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
	@echo 'cleared tmp/'
