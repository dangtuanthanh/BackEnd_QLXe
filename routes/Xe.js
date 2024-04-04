var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const path = require('path');//xử lý đường dẫn 

const sql = require("../handle/handleXe");//load file dboperation

// Middleware kiểm tra và xác thực tên miền truy cập
// const checkDomainAccess = (allowedDomains) => {
//   return (req, res, next) => {
//     const domain = req.headers.origin;
//     if (allowedDomains.includes(domain)) {
//       next();
//     } else {
//       res.status(403).send('Forbidden');
//     }
//   };
// };
// app.use(checkDomainAccess(['https://your-allowed-domain.com']));

//cấu hình cors


router.use(bodyParser.json());//cho phép xử lý dữ liệu gửi lên dạng json
router.use(bodyParser.urlencoded({ extended: false }));//cho phép xử lý dữ liệu gửi lên dạng application/x-www-form-urlencoded
router.get("/Xe", function (req, res, next) {
  res.render("index", { title: "Trang Quản Lý Xe" });
});

/*Quản lý tình trạng xe */
// lấy danh sách tình trạng xe
router.get("/getStatusCar", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MoTa"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getStatusCar')) {
      let result = await sql.getStatusCar();
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaTinhTrangXe == req.query.id);
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['MoTa'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'MoTa') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá tình trạng xe
router.delete('/deleteStatusCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteStatusCar')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      console.log('IDs', IDs);
      for (const ID of IDs) {
        sql.deleteStatusCar(ID)
          .catch(error => {
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Thêm tình trạng xe
router.post('/insertStatusCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertStatusCar')) {
    if (req.body.MoTa !== '') {
      sql.insertStatusCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật tình trạng xe
router.put('/updateStatusCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateStatusCar')) {
    if (req.body.MoTa !== '' || req.body.MaTinhTrangXe) {
      sql.updateStatusCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/*Quản lý nhóm loại xe */
// lấy danh sách nhóm loại xe
router.get("/getGroupTypeCar", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "TenNhomLoaiXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getGroupTypeCar')) {
      let result = await sql.getGroupTypeCar();
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaNhomLoaiXe == req.query.id);
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenNhomLoaiXe'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'TenNhomLoaiXe') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá nhóm loại xe
router.delete('/deleteGroupTypeCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteGroupTypeCar')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      console.log('IDs', IDs);
      for (const ID of IDs) {
        sql.deleteGroupTypeCar(ID)
          .catch(error => {
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Thêm nhóm loại xe
router.post('/insertGroupTypeCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertGroupTypeCar')) {
    if (req.body.TenNhomLoaiXe !== '') {
      sql.insertGroupTypeCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật nhóm loại xe
router.put('/updateGroupTypeCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateGroupTypeCar')) {
    if (req.body.TenNhomLoaiXe !== '' || req.body.MaNhomLoaiXe) {
      sql.updateGroupTypeCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/* Quản lý loại xe */
//tải danh sách loại xe
router.get("/getTypeCar", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaLoaiXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp
  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getTypeCar')) {
      let result = await sql.getTypeCar();
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaLoaiXe == req.query.id);
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenLoaiXe', 'TenNhomLoaiXe'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'TenLoaiXe' || sortBy === 'TenNhomLoaiXe') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });
        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá loại xe
router.delete('/deleteTypeCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteTypeCar')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteTypeCar(ID)
          .catch(error => {
            console.log("Lỗi khi cập nhật dữ liệu: " + error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Thêm loại xe
router.post('/insertTypeCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertTypeCar')) {
    if (req.body.TenLoaiXe && req.body.MaNhomLoaiXe) {
      sql.insertTypeCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật loại xe
router.put('/updateTypeCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateTypeCar')) {
    if (req.body.MaLoaiXe && req.body.TenLoaiXe && req.body.MaNhomLoaiXe) {
      sql.updateTypeCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/* Quản lý xe */
//tải danh sách xe
router.get("/getCar", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp
  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getCar')) {
      let result = await sql.getCar();
      result.forEach(item => {
        const date = new Date(item.NgayMua);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        item.NgayMua = formattedDate;
      });
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaXe == req.query.id);
        //đăng kiểm
        let resuiltRegistry = await sql.getServiceByIDCar(req.query.id, 'ChiTietDangKiem', 'LanDangKiem', 'NgayDangKiem', 'NgayHetHan');
        //bảo hiểm
        let resuiltInsurance = await sql.getServiceByIDCar(req.query.id, 'ChiTietMuaBaoHiem', 'LanMuaBaoHiem', 'NgayMuaBaoHiem', 'NgayHetHan');
        //phù hiệu
        let resuiltEmblem = await sql.getServiceByIDCar(req.query.id, 'ChiTietPhuHieu', 'LanPhuHieu', 'NgayCapPhuHieu', 'NgayHetHan');
        //định vị
        let resuiltLocate = await sql.getServiceByIDCar(req.query.id, 'ChiTietDinhVi', 'LanMuaDinhVi', 'NgayMua', 'NgayHetHan');
        let resuiltMaintenance = await sql.getServiceByIDCar(req.query.id, 'ChiTietBaoDuong', 'LanBaoDuong', 'NgayBaoDuong', 'NgayBaoDuongTiepTheo');
        let resuiltUsageHistory = await sql.getServiceByIDCar(req.query.id, 'ChiTietSuDung', 'LanSuDung', 'NgayDi', 'NgayVe');

        let resuiltDetailContract = await sql.getDetailContractByIDCar(req.query.id);
        //xử lý đăng kiểm
        const handleRegistry = formatDateResults(resuiltRegistry)
        const handleInsurance = formatDateResults(resuiltInsurance)
        const handleEmblem = formatDateResults(resuiltEmblem)
        const handleLocate = formatDateResults(resuiltLocate)
        const handleMaintenance = formatDateResults(resuiltMaintenance)
        const handleUsageHistory = formatDateResults(resuiltUsageHistory)
        const handleDetailContract = formatDateResults(resuiltDetailContract,true)
        const newFilteredData = {
          ...filteredData[0],
          DangKiem: handleRegistry,
          BaoHiem: handleInsurance,
          PhuHieu: handleEmblem,
          DinhVi: handleLocate,
          BaoDuong: handleMaintenance,
          LichSuSuDung: handleUsageHistory,
          HopDong: handleDetailContract
        };

        res.status(200).json(newFilteredData)
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['NhanHieu', 'TrongTai', 'Mau', 'LinhKien', 'MoTaTinhTrangXe'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'NhanHieu' || sortBy === 'TrongTai' || sortBy === 'Mau' || sortBy === 'LinhKien' || sortBy === 'MoTaTinhTrangXe') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });
        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
function formatDateResults(results, isHopDong = false) {
  results.forEach(item => {
    const date = new Date(item.Ngay);
    const date2 = new Date(item.NgayHetHan);

    const formattedDate = formatDate(date);
    const formattedDate2 = formatDate(date2);
    if (isHopDong) {
      item.SoHopDong=item.SoHopDong
      item.Lan = item.Lan;
      item.Ngay = formattedDate;
      item.NgayHetHan = formattedDate2;
    } else {
      item.Lan = item.Lan;
      item.Ngay = formattedDate;
      item.NgayHetHan = formattedDate2;
    }
  });

  return results;
}

function formatDate(date) {
  return (`0${date.getDate()}`).slice(-2) + '/' +
    (`0${date.getMonth() + 1}`).slice(-2) + '/' +
    date.getFullYear();
}
//Xoá xe
router.delete('/deleteCar', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteCar')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteCar(ID)
          .catch(error => {
            console.log("Lỗi khi cập nhật dữ liệu: " + error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/Xe/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newupload = multer({ storage: storage });
// Thêm xe
router.post('/insertCar', newupload.fields([
  { name: 'HinhAnh' },
  { name: 'HinhAnh2' },
  { name: 'HinhAnh3' },
  { name: 'HinhAnh4' }
]), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertCar')) {
    if (req.body.BienSoXe && req.body.MaTinhTrangXe && req.body.MaLoaiXe) {
      function processImage(file) {
        // xử lý đường dẫn file
        imagePath = file[0].path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/Xe', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/Xe/${newPath}`;
        return imagePathWithDomain;
      }
      let sdHinh2, sdHinh3, sdHinh4
      let primaryImage = null;
      //hình 1
      if (req.files.HinhAnh) {
        primaryImage = processImage(req.files.HinhAnh);
      } else if (req.files.HinhAnh2) {
        primaryImage = processImage(req.files.HinhAnh2);
        sdHinh2 = true
      } else if (req.files.HinhAnh3) {
        primaryImage = processImage(req.files.HinhAnh3);
        sdHinh3 = true
      } else if (req.files.HinhAnh4) {
        primaryImage = processImage(req.files.HinhAnh4);
        sdHinh4 = true
      }
      //hình 2
      let HinhAnh2 = null;
      if (req.files.HinhAnh2 && sdHinh2 != true) {
        HinhAnh2 = processImage(req.files.HinhAnh2);
      } else if (req.files.HinhAnh3 && sdHinh3 != true) {
        HinhAnh2 = processImage(req.files.HinhAnh3);
        sdHinh3 = true
      } else if (req.files.HinhAnh4 && sdHinh4 != true) {
        HinhAnh2 = processImage(req.files.HinhAnh4);
        sdHinh4 = true
      }
      //hình 3
      let HinhAnh3 = null;
      if (req.files.HinhAnh3 && sdHinh3 != true) {
        HinhAnh3 = processImage(req.files.HinhAnh3);
        sdHinh3 = true
      } else if (req.files.HinhAnh4 && sdHinh4 != true) {
        HinhAnh3 = processImage(req.files.HinhAnh4);
        sdHinh4 = true
      }
      //hình 4
      let HinhAnh4 = null;
      if (req.files.HinhAnh4 && sdHinh4 != true) {
        HinhAnh4 = processImage(req.files.HinhAnh4);
        sdHinh4 = true
      }
      data = {
        ...data,
        HinhAnh: primaryImage ? primaryImage : null,
        HinhAnh2: HinhAnh2 ? HinhAnh2 : null,
        HinhAnh3: HinhAnh3 ? HinhAnh3 : null,
        HinhAnh4: HinhAnh4 ? HinhAnh4 : null,
      }

      sql.insertCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật xe
router.put('/updateCar', newupload.fields([
  { name: 'HinhAnh' },
  { name: 'HinhAnh2' },
  { name: 'HinhAnh3' },
  { name: 'HinhAnh4' }
]), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateCar')) {
    if (req.body.BienSoXe && req.body.MaTinhTrangXe && req.body.MaLoaiXe && req.body.MaXe) {
      function processImage(file) {
        // xử lý đường dẫn file
        imagePath = file[0].path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/Xe', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/Xe/${newPath}`;
        return imagePathWithDomain;
      }
      let sdHinh2, sdHinh3, sdHinh4
      let primaryImage = req.body.HinhAnh != 'null' ? req.body.HinhAnh : null;
      //hình 1
      if (!req.body.HinhAnh || req.body.HinhAnh === 'null') {
        if (req.files.HinhAnh) {
          primaryImage = processImage(req.files.HinhAnh);
        } else if (req.files.HinhAnh2) {
          primaryImage = processImage(req.files.HinhAnh2);
          sdHinh2 = true
        } else if (req.files.HinhAnh3) {
          primaryImage = processImage(req.files.HinhAnh3);
          sdHinh3 = true
        } else if (req.files.HinhAnh4) {
          primaryImage = processImage(req.files.HinhAnh4);
          sdHinh4 = true
        }
      }
      //hình 2
      let HinhAnh2 = req.body.HinhAnh2 != 'null' ? req.body.HinhAnh2 : null;
      if (!req.body.HinhAnh2 || req.body.HinhAnh2 === 'null') {
        if (req.files.HinhAnh2 && sdHinh2 != true) {
          HinhAnh2 = processImage(req.files.HinhAnh2);
        } else if (req.files.HinhAnh3 && sdHinh3 != true) {
          HinhAnh2 = processImage(req.files.HinhAnh3);
          sdHinh3 = true
        } else if (req.files.HinhAnh4 && sdHinh4 != true) {
          HinhAnh2 = processImage(req.files.HinhAnh4);
          sdHinh4 = true
        }
      }
      //hình 3
      let HinhAnh3 = req.body.HinhAnh3 != 'null' ? req.body.HinhAnh3 : null;
      if (!req.body.HinhAnh3 || req.body.HinhAnh3 === 'null') {
        if (req.files.HinhAnh3 && sdHinh3 != true) {
          HinhAnh3 = processImage(req.files.HinhAnh3);
          sdHinh3 = true
        } else if (req.files.HinhAnh4 && sdHinh4 != true) {
          HinhAnh3 = processImage(req.files.HinhAnh4);
          sdHinh4 = true
        }
      }
      //hình 4
      let HinhAnh4 = req.body.HinhAnh4 != 'null' ? req.body.HinhAnh4 : null;
      if (!req.body.HinhAnh4 || req.body.HinhAnh4 === 'null') {
        if (req.files.HinhAnh4 && sdHinh4 != true) {
          HinhAnh4 = processImage(req.files.HinhAnh4);
          sdHinh4 = true
        }
      }
      data = {
        ...data,
        HinhAnh: primaryImage ? primaryImage : null,
        HinhAnh2: HinhAnh2 ? HinhAnh2 : null,
        HinhAnh3: HinhAnh3 ? HinhAnh3 : null,
        HinhAnh4: HinhAnh4 ? HinhAnh4 : null,
      }
      sql.updateCar(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/*Quản lý hạng mục bảo dưỡng */
// lấy danh sách hạng mục bảo dưỡng
router.get("/getMaintenanceItem", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "TenNhomLoaiXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getMaintenanceItem')) {
      let result = await sql.getMaintenanceItem();
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaHangMucBaoDuong == req.query.id);
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenNhomLoaiXe'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'TenNhomLoaiXe') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá hạng mục bảo dưỡng
router.delete('/deleteMaintenanceItem', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteMaintenanceItem')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteMaintenanceItem(ID)
          .catch(error => {
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Thêm hạng mục bảo dưỡng
router.post('/insertMaintenanceItem', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertMaintenanceItem')) {
    if (req.body.TenHangMuc) {
      sql.insertMaintenanceItem(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật hạng mục bảo dưỡng
router.put('/updateMaintenanceItem', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateMaintenanceItem')) {
    if (req.body.TenHangMuc || req.body.MaHangMucBaoDuong) {
      sql.updateMaintenanceItem(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/*Quản lý bảo dưỡng */
// lấy danh sách bảo dưỡng
router.get("/getMaintenance", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getMaintenance')) {
      let result = await sql.getMaintenance();
      const now = new Date();
      result.forEach(item => {
        const date = new Date(item.NgayBaoDuong);
        const date2 = new Date(item.NgayBaoDuongTiepTheo);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayBaoDuong = formattedDate;
        item.NgayBaoDuongTiepTheo = formattedDate2;
        const dateNow = new Date(now).setHours(0, 0, 0, 0);
        const dateEnd = new Date(date2).setHours(0, 0, 0, 0);
        const diffMs = dateNow - dateEnd;
        const diffDays = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if ((diffDays <= 7 && date2 > now) || diffDays == 0) {
          item.SapHetHan = true;
        } else {
          item.SapHetHan = false;
        }
      });

      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id && typeof req.query.id2 !== 'undefined' && !isNaN(req.query.id2))) {
        const filteredData = result.filter(item => {
          return (
            item.MaXe == req.query.id &&
            item.LanBaoDuong == req.query.id2
          );
        });

        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng lọc
        if (req.query.searchBy === 'LanMoiNhat') {
          // Lấy ra danh sách các Mã Xe duy nhất
          const maXeList = [...new Set(result.map(item => item.MaXe))];
          // Lọc ra item mới
          const filteredResult = [];
          maXeList.forEach(maXe => {
            // Tìm item có Mã Xe là maXe và Lần bảo dưỡng lớn nhất 
            const maxItem = result
              .filter(item => item.MaXe === maXe)
              .sort((a, b) => b.LanBaoDuong - a.LanBaoDuong)[0];

            // Nếu có thì đưa vào mảng kết quả  
            if (maxItem) {
              filteredResult.push(maxItem);
            }
          })
          result = filteredResult
        } else
          // tính năng tìm kiếm
          if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
            // Danh sách các cột có dữ liệu tiếng Việt
            const vietnameseColumns = ['NguoiDiBaoDuong', 'GhiChu'];

            // Lọc dữ liệu
            const filteredData = result.filter((row) => {
              const searchData = req.query.search;
              const searchBy = req.query.searchBy;

              // Lấy giá trị cột tìm kiếm
              const columnData = row[searchBy];

              //kiểm tra tìm kiếm chính xác
              if (searchExact) {
                // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
                const isVietnameseColumn = vietnameseColumns.includes(searchBy);

                // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
                if (isVietnameseColumn) {
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  }

                } else {
                  // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData);
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData);
                  }
                }
              } else {
                if (typeof columnData === 'string') {
                  const lowerCaseColumnData = columnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                }//cột dữ liệu có cột khác string
                else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                  const stringColumnData = String(columnData);
                  const lowerCaseColumnData = stringColumnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                } else if (columnData !== null) {
                  return false;
                }
              }



            });

            // Lưu kết quả lọc vào biến result
            result = filteredData;
          }
        //sắp xếp 
        //cột có ngày tháng 
        function compareDate(date1, date2) {
          const mDate1 = moment(date1, 'DD/MM/YYYY');
          const mDate2 = moment(date2, 'DD/MM/YYYY');
          if (mDate1.isBefore(mDate2)) {
            return sortOrder === 'asc' ? -1 : 1;
          }

          if (mDate1.isAfter(mDate2)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
        }
        result.sort((a, b) => {
          if (sortBy === 'NguoiDiBaoDuong' || sortBy === 'GhiChu') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else if (sortBy === 'NgayBaoDuong') {
            return compareDate(a.NgayBaoDuong, b.NgayBaoDuong, sortOrder);
          } if (sortBy === 'NgayBaoDuongTiepTheo') {
            return compareDate(a.NgayBaoDuongTiepTheo, b.NgayBaoDuongTiepTheo, sortOrder);
          }
          else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá bảo dưỡng
router.delete('/deleteMaintenance', async function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.body.ID;
  const ID2 = req.body.ID2;
  if (await sql.checkSessionAndRole(ss, 'deleteMaintenance')) {
    if (req.body.ID && req.body.ID2) {
      sql.deleteMaintenance(ID, ID2)
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });

      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

const storageBaoDuong = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/BaoDuong/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const uploadBaoDuong = multer({ storage: storageBaoDuong });
// Thêm bảo dưỡng
router.post('/insertMaintenance', uploadBaoDuong.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertMaintenance')) {
    if (req.body.MaXe && req.body.MaHangMucBaoDuong) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/BaoDuong', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/BaoDuong/${newPath}`;
        data = {
          ...data,
          HinhAnh: imagePathWithDomain
        }
      }
      sql.insertMaintenance(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật bảo dưỡng
router.put('/updateMaintenance', uploadBaoDuong.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateMaintenance')) {
    if (req.body.MaXe && req.body.LanBaoDuong && req.body.MaHangMucBaoDuong) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/BaoDuong', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/BaoDuong/${newPath}`;
        data = {
          ...data,
          HinhAnh: imagePathWithDomain
        }
      }
      sql.updateMaintenance(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi : " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});




/*Quản lý lịch sử sử dụng */
// lấy danh sách lịch sử sử dụng
router.get("/getUsageHistory", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getUsageHistory')) {
      let result = await sql.getUsageHistory();
      result.forEach(item => {
        const date = new Date(item.NgayDi);
        const date2 = new Date(item.NgayVe);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayDi = formattedDate;
        item.NgayVe = formattedDate2;
      });

      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id && typeof req.query.id2 !== 'undefined' && !isNaN(req.query.id2))) {
        const filteredData = result.filter(item => {
          return (
            item.MaXe == req.query.id &&
            item.LanSuDung == req.query.id2
          );
        });

        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng lọc
        if (req.query.searchBy === 'LanMoiNhat') {
          // Lấy ra danh sách các Mã Xe duy nhất
          const maXeList = [...new Set(result.map(item => item.MaXe))];
          // Lọc ra item mới
          const filteredResult = [];
          maXeList.forEach(maXe => {
            // Tìm item có Mã Xe là maXe và Lần lịch sử sử dụng lớn nhất 
            const maxItem = result
              .filter(item => item.MaXe === maXe)
              .sort((a, b) => b.LanSuDung - a.LanSuDung)[0];

            // Nếu có thì đưa vào mảng kết quả  
            if (maxItem) {
              filteredResult.push(maxItem);
            }
          })
          result = filteredResult
        } else
          // tính năng tìm kiếm
          if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
            // Danh sách các cột có dữ liệu tiếng Việt
            const vietnameseColumns = ['NguoiSuDung', 'MucDich'];

            // Lọc dữ liệu
            const filteredData = result.filter((row) => {
              const searchData = req.query.search;
              const searchBy = req.query.searchBy;

              // Lấy giá trị cột tìm kiếm
              const columnData = row[searchBy];

              //kiểm tra tìm kiếm chính xác
              if (searchExact) {
                // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
                const isVietnameseColumn = vietnameseColumns.includes(searchBy);

                // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
                if (isVietnameseColumn) {
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  }

                } else {
                  // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData);
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData);
                  }
                }
              } else {
                if (typeof columnData === 'string') {
                  const lowerCaseColumnData = columnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                }//cột dữ liệu có cột khác string
                else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                  const stringColumnData = String(columnData);
                  const lowerCaseColumnData = stringColumnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                } else if (columnData !== null) {
                  return false;
                }
              }



            });

            // Lưu kết quả lọc vào biến result
            result = filteredData;
          }
        //sắp xếp 
        //cột có ngày tháng 
        function compareDate(date1, date2) {
          const mDate1 = moment(date1, 'DD/MM/YYYY');
          const mDate2 = moment(date2, 'DD/MM/YYYY');
          if (mDate1.isBefore(mDate2)) {
            return sortOrder === 'asc' ? -1 : 1;
          }

          if (mDate1.isAfter(mDate2)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
        }
        result.sort((a, b) => {
          if (sortBy === 'NguoiSuDung' || sortBy === 'MucDich') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else if (sortBy === 'NgayDi') {
            return compareDate(a.NgayDi, b.NgayDi, sortOrder);
          } if (sortBy === 'NgayVe') {
            return compareDate(a.NgayVe, b.NgayVe, sortOrder);
          }
          else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá lịch sử sử dụng
router.delete('/deleteUsageHistory', async function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.body.ID;
  const ID2 = req.body.ID2;
  if (await sql.checkSessionAndRole(ss, 'deleteUsageHistory')) {
    if (req.body.ID && req.body.ID2) {
      sql.deleteUsageHistory(ID, ID2)
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });

      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

// Thêm lịch sử sử dụng
router.post('/insertUsageHistory', async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertUsageHistory')) {
    if (req.body.MaXe) {
      sql.insertUsageHistory(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật lịch sử sử dụng
router.put('/updateUsageHistory', async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateUsageHistory')) {
    if (req.body.MaXe && req.body.LanSuDung) {

      sql.updateUsageHistory(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi : " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
module.exports = router;
