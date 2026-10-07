.PHONY: hooks
hooks: ## Enable the project git hooks (run once after cloning)
	git config core.hooksPath .githooks
	chmod +x .githooks/*
