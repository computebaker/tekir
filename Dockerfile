FROM node:20-bookworm

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the app
RUN npm run build

# Expose the expected port (adjust if needed)
EXPOSE 3000

# Start the server
CMD [ "npm", "run", "start" ]
