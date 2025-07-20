FROM n8nio/n8n:1.102.4

# Use production environment
ENV NODE_ENV=production

# Expose port 5678
EXPOSE 5678

# Start n8n
CMD ["n8n"]