# Dev-only: a headless browser to take screenshots of the dev server. Never part of the site.
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble@sha256:72bd171a9ffc2b4b59532aaa6210e21014d07093120dc25528870c0b840da1f0
RUN pip install --no-cache-dir --break-system-packages playwright==1.63.0 greenlet==3.5.6 pyee==13.0.1
USER pwuser
WORKDIR /work
