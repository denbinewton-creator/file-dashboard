module.exports = {
  client: {
    service: {
      name: "file-dashboard",
      url: "http://localhost:8080/graphql",
    },
    includes: ["./frontend/src/**/*.{js,jsx,ts,tsx}"],
  },
};
