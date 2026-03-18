import { useEffect, useState } from "react";
import api from "../services/api";

function TestApi() {

  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/test")
      .then(res => setMessage(res.data.message))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h2>Test API</h2>
      <p>{message}</p>
    </div>
  );
}

export default TestApi;