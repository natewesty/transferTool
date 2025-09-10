const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3030;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
let pool;
if (process.env.DATABASE_URL) {
  // Use connection string if available
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      require: true
    }
  });
} else {
  // Fall back to individual parameters
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// API Routes

// Test endpoint to see what's in the database
app.get('/api/debug/products', async (req, res) => {
  try {
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM dim_product_variant`;
    const countResult = await pool.query(countQuery);
    const totalCount = countResult.rows[0].total;
    
    // Get sample products with has_inventory status
    const query = `
      SELECT product_variant_id, product_title, variant_title, volume_ml, sku, has_inventory
      FROM dim_product_variant 
      LIMIT 10
    `;
    const result = await pool.query(query);
    
    // Check has_inventory distribution
    const inventoryQuery = `
      SELECT has_inventory, COUNT(*) as count 
      FROM dim_product_variant 
      GROUP BY has_inventory
    `;
    const inventoryResult = await pool.query(inventoryQuery);
    
    console.log('Debug - Total products in database:', totalCount);
    console.log('Debug - has_inventory distribution:', inventoryResult.rows);
    console.log('Debug - Sample products (first 10):', result.rows);
    
    res.json({
      total: totalCount,
      hasInventoryDistribution: inventoryResult.rows,
      sampleProducts: result.rows,
      message: 'Check server console for detailed output'
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// Get all product variants for search dropdown
app.get('/api/products', async (req, res) => {
  try {
    const query = `
      SELECT product_variant_id, product_title, variant_title, volume_ml, sku, sub_title
      FROM dim_product_variant 
      WHERE (sub_title IS NULL OR sub_title NOT ILIKE '%Wine Bundle%')
      ORDER BY product_title, variant_title
    `;
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} products in database (excluded Wine Bundle items)`);
    if (result.rows.length > 0) {
      console.log('Sample products:', result.rows.slice(0, 3).map(p => p.product_title));
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Search products by title with fuzzy matching
app.get('/api/products/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }
    
    console.log(`Searching for: "${q}"`);
    
    // Split search query into individual words and clean them
    const searchWords = q.trim().split(/\s+/).filter(word => word.length > 0);
    console.log('Search words:', searchWords);
    
    if (searchWords.length === 0) {
      return res.json([]);
    }
    
    // Build dynamic query for fuzzy matching
    // Each word must appear somewhere in the product title
    const wordConditions = searchWords.map((_, index) => `product_title ILIKE $${index + 1}`).join(' AND ');
    
    // Also include exact substring match for better ranking
    const exactMatchCondition = `product_title ILIKE $${searchWords.length + 1}`;
    const startsWithCondition = `product_title ILIKE $${searchWords.length + 2}`;
    const endsWithCondition = `product_title ILIKE $${searchWords.length + 3}`;
    
    const query = `
      SELECT product_variant_id, product_title, variant_title, volume_ml, sku, sub_title,
             CASE 
               WHEN product_title ILIKE $${searchWords.length + 1} THEN 1
               WHEN product_title ILIKE $${searchWords.length + 2} THEN 2
               WHEN product_title ILIKE $${searchWords.length + 3} THEN 3
               ELSE 4
             END as exact_match_rank
      FROM dim_product_variant 
      WHERE (
        (${wordConditions})
        OR ${exactMatchCondition}
        OR ${startsWithCondition}
        OR ${endsWithCondition}
      )
      AND (sub_title IS NULL OR sub_title NOT ILIKE '%Wine Bundle%')
      ORDER BY 
        exact_match_rank,
        product_title, variant_title
      LIMIT 20
    `;
    
    // Build search parameters
    const searchParams = [
      // Individual word matches
      ...searchWords.map(word => `%${word}%`),
      // Exact substring match
      `%${q}%`,
      // Starts with query
      `${q}%`,
      // Ends with query
      `%${q}`
    ];
    
    console.log('Search parameters:', searchParams);
    
    const result = await pool.query(query, searchParams);
    console.log(`Found ${result.rows.length} search results for "${q}" (excluded Wine Bundle items)`);
    if (result.rows.length > 0) {
      console.log('Search results:', result.rows.map(p => p.product_title));
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Submit transfer request
app.post('/api/transfer', async (req, res) => {
  try {
    const { transferFrom, transferTo, items, notes, authorizedBy } = req.body;
    
    if (!transferFrom || !transferTo || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create transfer document
    const transferDoc = createTransferDocument(transferFrom, transferTo, items, notes, authorizedBy);
    
    // Send email
    await sendTransferEmail(transferDoc);
    
    res.json({ 
      success: true, 
      message: 'Transfer request submitted successfully',
      transferDoc 
    });
    
  } catch (error) {
    console.error('Error submitting transfer:', error);
    res.status(500).json({ error: 'Failed to submit transfer request' });
  }
});



// Helper function to create transfer document
function createTransferDocument(transferFrom, transferTo, items, notes, authorizedBy) {
  const timestamp = new Date().toISOString();
  const transferId = `TR-${Date.now()}`;
  
  let totalBottles = 0;
  let totalCases = 0;
  
  const formattedItems = items.map(item => {
    const bottles = item.bottles || 0;
    const cases = item.cases || 0;
    
    // Use exactly what the user entered - no optimization/conversion
    totalBottles += bottles;
    totalCases += cases;
    
    return {
      product: item.product,
      sku: item.sku || '',
      bottles: bottles,
      cases: cases,
      volume: item.volume
    };
  });
  
  return {
    transferId,
    timestamp,
    transferFrom,
    transferTo,
    items: formattedItems,
    notes: notes || '',
    authorizedBy: authorizedBy || '',
    summary: {
      totalBottles,
      totalCases,
      totalItems: items.length
    }
  };
}

// Helper function to send transfer email
async function sendTransferEmail(transferDoc) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Determine recipients based on transfer conditions
    let recipients = process.env.INVENTORY_OFFICER_EMAIL;
    
    // Add INVENTORY_TECH_EMAIL for specific transfer conditions
    if (transferDoc.transferFrom === "Groskopf" && transferDoc.transferTo === "Donum - Tasting Room") {
      recipients = `${process.env.INVENTORY_OFFICER_EMAIL}, ${process.env.INVENTORY_TECH_EMAIL}`;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipients,
      subject: `Inventory Transfer Request - ${transferDoc.transferId}`,
      html: `
        <h2>Inventory Transfer Request</h2>
        <p><strong>Transfer ID:</strong> ${transferDoc.transferId}</p>
        <p><strong>Date:</strong> ${new Date(transferDoc.timestamp).toLocaleString()}</p>
        <p><strong>From:</strong> ${transferDoc.transferFrom}</p>
        <p><strong>To:</strong> ${transferDoc.transferTo}</p>
        <p><strong>Authorized By:</strong> ${transferDoc.authorizedBy || 'Not specified'}</p>
        
        <h3>Items to Transfer:</h3>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <tr>
            <th style="padding: 8px;">Product</th>
            <th style="padding: 8px;">SKU</th>
            <th style="padding: 8px;">Bottles</th>
            <th style="padding: 8px;">Cases (9L)</th>
          </tr>
          ${transferDoc.items.map(item => `
            <tr>
              <td style="padding: 8px;">${item.product}</td>
              <td style="padding: 8px;">${item.sku}</td>
              <td style="padding: 8px;">${item.bottles}</td>
              <td style="padding: 8px;">${item.cases}</td>
            </tr>
          `).join('')}
        </table>
        
        ${transferDoc.notes ? `
        <h3>Additional Notes:</h3>
        <p style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
          ${transferDoc.notes}
        </p>
        ` : ''}
        
        <h3>Summary:</h3>
        <p><strong>Total SKUs:</strong> ${transferDoc.summary.totalItems}</p>
        <p><strong>Total Bottles/Units:</strong> ${transferDoc.summary.totalBottles}</p>
        <p><strong>Total Cases:</strong> ${transferDoc.summary.totalCases}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Transfer email sent successfully');
    
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});