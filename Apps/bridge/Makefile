# dtbridge build — see Docs/Stage-04-Fixes/plans/bridge/print-bridge-plan-v1.md.
#
# The Go toolchain on this dev machine lives at /usr/local/go/bin and is not on the default PATH
# for non-login shells (plan §3, G4). Exporting it once here means every recipe below can just
# call `go` normally.
export PATH := $(PATH):/usr/local/go/bin

BINARY := dtbridge
DIST   := dist

.PHONY: build build-windows build-windows-386 build-windows-arm64 build-all test vet fmt clean

build:
	go build -o $(DIST)/$(BINARY) ./cmd/dtbridge

# windows/amd64 is the one real target — a shop counter PC. The 386 and arm64 variants are built
# too (cheap, already verified clean in Sprint 4) in case a shop's counter PC turns out unusual.
build-windows:
	GOOS=windows GOARCH=amd64 go build -o $(DIST)/$(BINARY).exe ./cmd/dtbridge

build-windows-386:
	GOOS=windows GOARCH=386 go build -o $(DIST)/$(BINARY)-386.exe ./cmd/dtbridge

build-windows-arm64:
	GOOS=windows GOARCH=arm64 go build -o $(DIST)/$(BINARY)-arm64.exe ./cmd/dtbridge

build-all: build build-windows build-windows-386 build-windows-arm64

test:
	go test ./... -race -count=1

vet:
	go vet ./...

fmt:
	gofmt -w .

clean:
	rm -rf $(DIST)
