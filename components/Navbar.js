import Link from 'next/link';
import { FaGlobe } from 'react-icons/fa';

const Navbar = () => {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center space-x-4">
        <Link href="https://tech.mevcentral.com" target="_blank" rel="noopener noreferrer">
          <a className="social-link">
            <FaGlobe className="text-xl" />
          </a>
        </Link>
      </div>
    </div>
  );
};

export default Navbar; 