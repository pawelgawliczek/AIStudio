import { useState, useEffect } from "react";

function App() {
  const [greeting, setGreeting] = useState("VibeStudio Agent");

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>{greeting}</h1>

      <section
        style={{
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ fontSize: "18px", marginBottom: "10px" }}>
          Connection Status
        </h2>
        <p style={{ color: "#666" }}>Status: Initializing...</p>
      </section>

      <section
        style={{
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ fontSize: "18px", marginBottom: "10px" }}>
          Active Sessions
        </h2>
        <p style={{ color: "#666" }}>No active sessions</p>
      </section>

      <section
        style={{
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ fontSize: "18px", marginBottom: "10px" }}>Queue Status</h2>
        <p style={{ color: "#666" }}>Queue: Empty</p>
      </section>

      <footer
        style={{
          marginTop: "auto",
          paddingTop: "20px",
          borderTop: "1px solid #ddd",
          fontSize: "12px",
          color: "#999",
          textAlign: "center",
        }}
      >
        VibeStudio Agent v0.1.0
      </footer>
    </div>
  );
}

export default App;
