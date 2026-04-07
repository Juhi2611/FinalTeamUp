import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "Blocked invalid route:",
      location.pathname
    );

    navigate("/", { replace: true });
  }, []);

  return null; // 👈 NOTHING is rendered
};

export default NotFound;
