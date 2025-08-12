# Inventory Transfer Tool

A web-based tool for managing inventory transfers between different locations, specifically designed for wine products. The tool allows users to create transfer requests with automatic bottle-to-case conversion and sends formatted emails to inventory control officers.

## Features

- **Location Selection**: Choose from predefined locations (Groskopf, Donum - Tasting Room, Copper Peak) or specify custom locations
- **Product Search**: Searchable dropdown for products from the PostgreSQL data warehouse
- **Automatic Conversion**: Converts between bottles and 9L cases based on product volume
- **Dynamic Item Grid**: Add/remove items as needed
- **Email Integration**: Automatically sends formatted transfer requests to inventory officers
- **Responsive Design**: Works on desktop and mobile devices

## Technical Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database connection using `pg` library
- **Nodemailer** for email functionality
- **CORS** enabled for cross-origin requests

### Frontend
- **Vanilla JavaScript** (ES6+)
- **CSS3** with modern design and responsive layout
- **HTML5** semantic markup

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database access
- SMTP email server credentials

## Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `env.example` to `.env`
   - Fill in your database and email credentials:
   ```env
   # Database Configuration
   DB_HOST=your_database_host
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password

   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_password
   INVENTORY_OFFICER_EMAIL=inventory@company.com
   ```

## Database Schema

The tool connects to a `dim_product_variant` table with the following structure:

```sql
CREATE TABLE "public"."dim_product_variant" (
    "product_variant_id" uuid,
    "product_id" uuid,
    "product_title" text,
    "variant_title" text,
    "product_type" text,
    "varietal" text,
    "vintage" int4,
    "sku" text,
    "price" numeric,
    "cost_of_good" numeric,
    "volume_ml" int4,
    "abv" numeric,
    "has_inventory" bool,
    "has_shipping" bool,
    "department_title" text,
    "web_status" text,
    "admin_status" text,
    "created_at" timestamp,
    "updated_at" timestamp
);
```

## Usage

### Starting the Application

1. **Development mode** (with auto-restart):
   ```bash
   npm run dev
   ```

2. **Production mode**:
   ```bash
   npm start
   ```

3. **Access the application**:
   - Open your browser and navigate to `http://localhost:3000`
   - The backend API will be available at `http://localhost:3000/api/*`

### Using the Transfer Tool

1. **Select Transfer Locations**
   - Choose "Transfer From" and "Transfer To" locations
   - Select "Other" to specify custom locations

2. **Add Items**
   - Click "+ Add Item" to add new rows
   - Search for products by typing in the product field
   - Enter either bottles or cases - the other field will auto-calculate

3. **Submit Transfer Request**
   - Click "Submit Transfer Request" when ready
   - The system will create a formatted document and email it to the inventory officer

## API Endpoints

### GET `/api/products`
Returns all available products for the dropdown.

### GET `/api/products/search?q=<query>`
Searches products by title with partial matching.

### POST `/api/transfer`
Submits a transfer request with the following body:
```json
{
  "transferFrom": "Location Name",
  "transferTo": "Location Name",
  "items": [
    {
      "product": "Product Title",
      "productId": "uuid",
      "sku": "SKU123",
      "volume": 750,
      "bottles": 12,
      "cases": 1.0
    }
  ]
}
```

## Conversion Logic

The tool automatically converts between bottles and 9L cases:

- **750ml bottles**: 1 case = 12 bottles
- **1.5L bottles**: 1 case = 6 bottles
- **Other volumes**: Calculated proportionally (1 case = 9000ml total volume)

## File Structure

```
transferTool/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── env.example            # Environment variables template
├── README.md              # This file
└── public/                # Frontend files
    ├── index.html         # Main HTML page
    ├── styles.css         # CSS styling
    └── script.js          # Frontend JavaScript
```

## Customization

### Adding New Locations
Edit the location options in `public/index.html`:
```html
<option value="New Location">New Location</option>
```

### Modifying Email Template
Edit the `sendTransferEmail` function in `server.js` to customize the email format.

### Changing Conversion Ratios
Modify the `calculateCases` and `calculateBottles` functions in `public/script.js`.

## Troubleshooting

### Database Connection Issues
- Verify your `.env` file has correct database credentials
- Ensure the PostgreSQL server is running and accessible
- Check firewall settings if connecting to a remote database

### Email Issues
- Verify SMTP credentials in `.env`
- For Gmail, you may need to use an App Password instead of your regular password
- Check if your email provider requires specific security settings

### Frontend Issues
- Check browser console for JavaScript errors
- Ensure all files are in the `public/` directory
- Verify the server is running on the expected port

## Security Considerations

- Store sensitive credentials in environment variables (never in code)
- Use HTTPS in production
- Implement proper authentication if needed
- Consider rate limiting for API endpoints
- Validate all user inputs on both frontend and backend

## License

MIT License - feel free to modify and use as needed.

## Support

For issues or questions, check the browser console and server logs for error messages. The tool includes comprehensive error handling and user feedback.
