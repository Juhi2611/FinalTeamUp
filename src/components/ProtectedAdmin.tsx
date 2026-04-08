import { Navigate } from "react-router-dom";

const ProtectedAdmin = ({ children }: any) => {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    return <Navigate to="/admin-login" />;
  }

  return children;
};

export default ProtectedAdmin;