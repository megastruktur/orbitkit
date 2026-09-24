# OrbitKit Linux Desktop Build & Test Environment
# Image: orbitkit-linux-desktop:1
# Base: rust:1-bookworm

FROM rust:1-bookworm

# Prevent interactive debconf prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies required for WebKit2GTK, Tauri desktop builds, Xvfb testing, and tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libwebkit2gtk-4.1-dev \
        build-essential \
        curl \
        wget \
        file \
        libxdo-dev \
        libssl-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        xvfb \
        xdotool \
        x11-utils \
        wmctrl \
        imagemagick \
        ffmpeg \
        openbox \
        shellcheck \
        fonts-dejavu-core \
        dbus-x11 \
        ca-certificates \
        gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g pnpm@12.4.1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create unprivileged user builder (uid 1000, gid 1000) matching host workspace owner
RUN groupadd -g 1000 builder && \
    useradd -u 1000 -g 1000 -m -s /bin/bash builder && \
    mkdir -p /cargo-cache /pnpm-store /home/builder/.local/share/pnpm /home/megastruktur /tmp/.X11-unix && \
    chown -R 1000:1000 /cargo-cache /pnpm-store /home/builder /home/megastruktur && \
    chmod 777 /cargo-cache /pnpm-store && \
    chmod 1777 /tmp/.X11-unix

# Environment configuration
ENV HOME=/home/builder
ENV CARGO_HOME=/cargo-cache
ENV PNPM_HOME=/pnpm-store
ENV PATH=$CARGO_HOME/bin:/usr/local/cargo/bin:/usr/local/bin:$PATH

# WebKit & Headless display defaults for containerized execution
ENV WEBKIT_DISABLE_COMPOSITING_MODE=1
ENV WEBKIT_DISABLE_DMABUF_RENDERER=1
ENV WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV GDK_BACKEND=x11
